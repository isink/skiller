import AuthenticationServices
import SwiftData
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthService
    @Query private var favorites: [Favorite]
    @Query private var recents: [RecentView]
    @State private var signingIn = false
    @State private var authError: String? = nil
    @State private var appleNonce: String? = nil

    private var topCategorySlug: String? {
        guard !recents.isEmpty else { return nil }
        let grouped = Dictionary(grouping: recents, by: \.category)
        return grouped.max(by: { $0.value.count < $1.value.count })?.key
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                brandHeader
                accountCard
                footprintCard

                section(title: "贡献") {
                    submitRow
                }

                section(title: "社区") {
                    linkRow(
                        icon: "chevron.left.forwardslash.chevron.right",
                        title: "Anthropic 官方技能库",
                        subtitle: "github.com/anthropics/skills",
                        url: "https://github.com/anthropics/skills"
                    )
                    divider
                    linkRow(
                        icon: "book.fill",
                        title: "Claude Skills 文档",
                        url: "https://docs.anthropic.com/en/docs/claude-code/skills-and-packages"
                    )
                }

                privacyFootnote
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(Color.bg.ignoresSafeArea())
        .navigationBarHidden(true)
    }

    // MARK: Brand
    private var brandHeader: some View {
        VStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.brand.opacity(0.18))
                    .frame(width: 64, height: 64)
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(Color.brand)
            }
            Text("Skiller")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text("发现并安装 Claude AI 技能")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    // MARK: Account
    @ViewBuilder
    private var accountCard: some View {
        switch auth.state {
        case .unknown:
            EmptyView()
        case .signedOut:
            signedOutCard
        case .signedIn(let identity):
            signedInCard(identity)
        }
    }

    private var signedOutCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("登录后可推荐 GitHub 仓库")
                .font(.system(size: 13))
                .foregroundStyle(Color.textSubtle)

            SignInWithAppleButton(
                .signIn,
                onRequest: { request in
                    let nonce = AuthService.makeRawNonce()
                    appleNonce = nonce
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = AuthService.sha256Hex(nonce)
                },
                onCompletion: { result in
                    Task { await handleAppleResult(result) }
                }
            )
            .signInWithAppleButtonStyle(.white)
            .frame(height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 12))

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
                    Text(signingIn ? "登录中…" : "使用 GitHub 登录")
                        .font(.system(size: 14, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(.black)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(signingIn)

            if let msg = authError {
                Text(msg)
                    .font(.system(size: 11))
                    .foregroundStyle(.red)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func signedInCard(_ identity: AuthService.UserIdentity) -> some View {
        HStack(spacing: 12) {
            avatar(identity.avatarUrl)
            VStack(alignment: .leading, spacing: 2) {
                Text(identity.displayName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.textPrimary)
                Text("@\(identity.login)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textSubtle)
            }
            Spacer()
            Button {
                Task { await auth.signOut() }
            } label: {
                Text("退出")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textSubtle)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.bg)
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.borderSubtle, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func avatar(_ url: URL?) -> some View {
        if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color.bg
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Color.borderSubtle, lineWidth: 1))
        } else {
            ZStack {
                Circle().fill(Color.brand.opacity(0.18))
                Image(systemName: "person.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.brand)
            }
            .frame(width: 40, height: 40)
        }
    }

    @MainActor
    private func signIn() async {
        signingIn = true
        authError = nil
        do {
            try await auth.signInWithGitHub()
        } catch {
            print("GitHub sign-in failed: \(error)")
            if !isUserCancelled(error) {
                authError = "登录失败，请稍后重试"
            }
        }
        signingIn = false
    }

    @MainActor
    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authResult):
            guard
                let credential = authResult.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let token = String(data: tokenData, encoding: .utf8),
                let nonce = appleNonce
            else {
                authError = "苹果登录失败，请稍后重试"
                return
            }
            do {
                try await auth.signInWithApple(idToken: token, nonce: nonce)
                authError = nil
            } catch {
                print("Apple sign-in failed: \(error)")
                authError = "苹果登录失败，请稍后重试"
            }
        case .failure(let error):
            print("Apple sign-in failed: \(error)")
            if !isUserCancelled(error) {
                authError = "苹果登录失败，请稍后重试"
            }
        }
        appleNonce = nil
    }

    private func isUserCancelled(_ error: Error) -> Bool {
        let ns = error as NSError
        if ns.domain == "com.apple.AuthenticationServices.WebAuthenticationSession" && ns.code == 1 {
            return true
        }
        if ns.domain == ASAuthorizationError.errorDomain
            && ns.code == ASAuthorizationError.canceled.rawValue {
            return true
        }
        return false
    }

    // MARK: Footprint
    private var footprintCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.brand)
                Text("我的足迹")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.textSubtle)
            }

            HStack(spacing: 0) {
                stat(value: "\(favorites.count)", label: "已收藏")
                statDivider
                stat(value: "\(recents.count)", label: "浏览过")
                statDivider
                topStat
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.bgCard)
        .overlay(
            RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func stat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Color.textSubtle)
        }
        .frame(maxWidth: .infinity)
    }

    private var topStat: some View {
        VStack(spacing: 4) {
            if let slug = topCategorySlug {
                HStack(spacing: 4) {
                    Image(systemName: CategoryMeta.sfSymbol(slug))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.brand)
                    Text(CategoryMeta.displayName(slug))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.textPrimary)
                }
                .frame(height: 30)
            } else {
                Text("—")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.textSubtle)
                    .frame(height: 30)
            }
            Text("最常看")
                .font(.system(size: 11))
                .foregroundStyle(Color.textSubtle)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color.borderSubtle)
            .frame(width: 1, height: 36)
    }

    // MARK: Section
    private func section<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textSubtle)
                .tracking(1.4)
                .textCase(.uppercase)
                .padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .background(Color.bgCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.borderSubtle)
            .frame(height: 1)
            .padding(.leading, 50)
    }

    private var submitRow: some View {
        NavigationLink(value: SkillRoute.submit) {
            HStack(spacing: 12) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.brand)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text("提交 Skill")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textPrimary)
                    Text("推荐一个 GitHub 仓库给我们收录")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textSubtle)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textSubtle)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: Privacy footnote
    private var privacyFootnote: some View {
        HStack {
            Spacer()
            Link(destination: URL(string: "https://isink.github.io/skiller/privacy.html")!) {
                Text("隐私政策")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.textSubtle)
                    .underline(true, color: Color.textSubtle.opacity(0.5))
            }
            Spacer()
        }
        .padding(.top, 16)
    }

    private func linkRow(icon: String, title: String, subtitle: String? = nil, url: String) -> some View {
        Link(destination: URL(string: url) ?? URL(string: "https://example.com")!) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(Color.brand)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.textSubtle)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textSubtle)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
    }
}
