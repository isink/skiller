import SwiftUI

struct SubmitSkillView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthService

    @State private var repos: [GitHubRepo] = []
    @State private var loading = false
    @State private var loadError: String? = nil
    @State private var submittingRepoId: Int? = nil
    @State private var submittedRepoIds: Set<Int> = []
    @State private var pendingRepo: GitHubRepo? = nil
    @State private var signingIn = false

    private var stateKey: String {
        switch auth.state {
        case .unknown: return "unknown"
        case .signedOut: return "signedOut"
        case .signedIn(let id): return "signedIn:\(id.userId)"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                intro
                content
                guidelines
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
        .background(Color.bg.ignoresSafeArea())
        .toolbarBackground(Color.bg, for: .navigationBar)
        .task(id: stateKey) { await loadIfNeeded() }
        .refreshable { await loadRepos() }
        .alert(
            "提交这个仓库？",
            isPresented: Binding(
                get: { pendingRepo != nil },
                set: { if !$0 { pendingRepo = nil } }
            ),
            presenting: pendingRepo
        ) { repo in
            Button("提交") {
                let r = repo
                Task { await submit(r) }
            }
            Button("取消", role: .cancel) {}
        } message: { repo in
            Text("\(repo.fullName)\n审核通过后会出现在 Skiller 里")
        }
    }

    // MARK: - Header
    private var intro: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("推荐你的 Skill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("从你的 GitHub 仓库里挑一个，我们会人工审核后收录")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
        }
    }

    // MARK: - Routing on auth state
    @ViewBuilder
    private var content: some View {
        switch auth.state {
        case .unknown:
            ProgressView()
                .tint(Color.brand)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
        case .signedOut:
            loginGate
        case .signedIn(let identity):
            picker(identity: identity)
        }
    }

    // MARK: - Login gate
    private var loginGate: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 28))
                .foregroundStyle(Color.brand)
            Text("请先登录")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("登录后才能从你的 GitHub 仓库里挑选要推荐的 Skill")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
            Button {
                Task { await signIn() }
            } label: {
                HStack(spacing: 8) {
                    if signingIn {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "chevron.left.forwardslash.chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    Text(signingIn ? "登录中…" : "使用 GitHub 登录")
                        .font(.system(size: 14, weight: .semibold))
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .foregroundStyle(.white)
                .background(Color.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(signingIn)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 16)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @MainActor
    private func signIn() async {
        signingIn = true
        do {
            try await auth.signInWithGitHub()
        } catch {
            print("GitHub sign-in failed: \(error)")
        }
        signingIn = false
    }

    // MARK: - Repo picker
    @ViewBuilder
    private func picker(identity: AuthService.GitHubIdentity) -> some View {
        if loading && repos.isEmpty {
            HStack {
                Spacer()
                ProgressView().tint(Color.brand)
                Spacer()
            }
            .padding(.vertical, 40)
        } else if let msg = loadError, repos.isEmpty {
            errorCard(message: msg)
        } else if repos.isEmpty {
            emptyCard
        } else {
            VStack(spacing: 0) {
                ForEach(Array(repos.enumerated()), id: \.element.id) { index, repo in
                    if index > 0 { divider }
                    repoRow(repo)
                }
            }
            .background(Color.bgCard)
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func repoRow(_ repo: GitHubRepo) -> some View {
        let submitted = submittedRepoIds.contains(repo.id)
        let isSubmitting = submittingRepoId == repo.id

        return Button {
            guard !submitted, !isSubmitting else { return }
            pendingRepo = repo
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(repo.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                    if let desc = repo.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.textSubtle)
                            .lineLimit(2)
                    }
                    HStack(spacing: 10) {
                        if repo.stargazersCount > 0 {
                            Label("\(repo.stargazersCount)", systemImage: "star.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.textMuted)
                                .labelStyle(.titleAndIcon)
                        }
                        if let lang = repo.language {
                            Text(lang)
                                .font(.system(size: 10))
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                }
                Spacer()
                trailing(submitted: submitted, submitting: isSubmitting)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(submitted || isSubmitting)
    }

    @ViewBuilder
    private func trailing(submitted: Bool, submitting: Bool) -> some View {
        if submitting {
            ProgressView().tint(Color.brand)
        } else if submitted {
            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14))
                Text("已提交")
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(Color.accentGreen)
        } else {
            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.borderSubtle)
            .frame(height: 1)
            .padding(.leading, 16)
    }

    // MARK: - Empty / error
    private var emptyCard: some View {
        VStack(spacing: 8) {
            Image(systemName: "tray")
                .font(.system(size: 24))
                .foregroundStyle(Color.textSubtle)
            Text("没有找到公开仓库")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
            Text("你的 GitHub 账号下还没有公开仓库")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 16)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func errorCard(message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 24))
                .foregroundStyle(.red)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
            Button {
                Task { await loadRepos() }
            } label: {
                Text("重试")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 8)
                    .background(Color.brand)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Guidelines
    private var guidelines: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("收录条件")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textSubtle)
                .tracking(1.4)
                .textCase(.uppercase)
            bullet("仓库公开可访问,README 写明用途")
            bullet("符合 Claude Skill 规范,至少含一个 SKILL.md")
            bullet("不含恶意代码、版权侵犯或不当内容")
        }
        .padding(.top, 8)
    }

    private func bullet(_ s: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text("·").foregroundStyle(Color.textMuted)
            Text(s)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
        }
    }

    // MARK: - Data
    private func loadIfNeeded() async {
        guard case .signedIn = auth.state else { return }
        guard repos.isEmpty, !loading else { return }
        await loadRepos()
    }

    @MainActor
    private func loadRepos() async {
        guard case .signedIn(let identity) = auth.state else { return }
        guard let token = identity.providerToken else {
            loadError = "未拿到 GitHub 授权 Token,请重新登录后再试"
            return
        }
        loading = true
        loadError = nil
        do {
            let list = try await GitHubAPI.listMyRepos(token: token)
            repos = list.filter { !$0.fork && !$0.isPrivate }
        } catch {
            print("Load repos failed: \(error)")
            loadError = "拉取仓库失败,请检查网络后重试"
        }
        loading = false
    }

    @MainActor
    private func submit(_ repo: GitHubRepo) async {
        guard case .signedIn(let identity) = auth.state else { return }
        submittingRepoId = repo.id
        do {
            try await SkillsAPI.submitSkill(
                githubUrl: repo.htmlUrl.absoluteString,
                email: nil,
                note: nil,
                userId: identity.userId
            )
            submittedRepoIds.insert(repo.id)
        } catch {
            print("Submit failed: \(error)")
            loadError = "提交失败,请稍后重试"
        }
        submittingRepoId = nil
    }
}
