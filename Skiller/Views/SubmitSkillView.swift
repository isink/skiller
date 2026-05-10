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
            "Submit this repo?",
            isPresented: Binding(
                get: { pendingRepo != nil },
                set: { if !$0 { pendingRepo = nil } }
            ),
            presenting: pendingRepo
        ) { repo in
            Button("Submit") {
                let r = repo
                Task { await submit(r) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { repo in
            Text("\(repo.fullName)\nWill appear in Skiller after review")
        }
    }

    // MARK: - Header
    private var intro: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Recommend Your Skill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("Pick one of your GitHub repos, we'll review and include it")
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
            if identity.provider == .github {
                picker(identity: identity)
            } else {
                githubRequiredCard
            }
        }
    }

    private var githubRequiredCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "chevron.left.forwardslash.chevron.right")
                .font(.system(size: 28))
                .foregroundStyle(Color.brand)
            Text("GitHub account required")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("Please sign out and sign in with GitHub to submit a repo")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
            Button {
                Task { await auth.signOut() }
            } label: {
                Text("Sign out current account")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Color.textPrimary)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 16)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Login gate
    private var loginGate: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 28))
                .foregroundStyle(Color.brand)
            Text("Sign in first")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("Sign in to pick a Skill from your GitHub repos")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
            Button {
                Task { await signIn() }
            } label: {
                HStack(spacing: 8) {
                    if signingIn {
                        ProgressView().tint(.black)
                    } else {
                        Image("GitHubMark")
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 16, height: 16)
                    }
                    Text(signingIn ? "Signing in…" : "Sign in with GitHub")
                        .font(.system(size: 14, weight: .semibold))
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .foregroundStyle(.black)
                .background(.white)
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
    private func picker(identity: AuthService.UserIdentity) -> some View {
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
                Text("Submitted")
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
            Text("No public repos found")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
            Text("Your GitHub account has no public repos yet")
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
                Text("Retry")
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
            Text("Submission Guidelines")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textSubtle)
                .tracking(1.4)
                .textCase(.uppercase)
            bullet("Repo is publicly accessible, README explains its purpose")
            bullet("Follows Claude Skill spec, contains at least one SKILL.md")
            bullet("No malicious code, copyright violation, or inappropriate content")
        }
        .padding(.top, 8)
    }

    private func bullet(_ s: LocalizedStringKey) -> some View {
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
            loadError = String(localized: "GitHub auth token missing, please sign in again")
            return
        }
        loading = true
        loadError = nil
        do {
            let list = try await GitHubAPI.listMyRepos(token: token)
            repos = list.filter { !$0.fork && !$0.isPrivate }
        } catch {
            print("Load repos failed: \(error)")
            loadError = String(localized: "Failed to fetch repos, check your network and try again")
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
            loadError = String(localized: "Submission failed, please try again later")
        }
        submittingRepoId = nil
    }
}
