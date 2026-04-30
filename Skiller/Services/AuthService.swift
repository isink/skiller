import Foundation
import Supabase

/// Holds the current Supabase auth session and exposes provider login flows.
/// SwiftUI views observe `state` to switch between guest and signed-in UI.
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    enum State: Equatable {
        case unknown
        case signedOut
        case signedIn(GitHubIdentity)
    }

    struct GitHubIdentity: Equatable {
        let userId: UUID
        let login: String
        let displayName: String
        let avatarUrl: URL?
        let providerToken: String?
    }

    @Published private(set) var state: State = .unknown

    private var listenerTask: Task<Void, Never>?

    private init() {
        listenerTask = Task { [weak self] in
            guard let self else { return }
            for await change in supabase.auth.authStateChanges {
                await self.apply(session: change.session)
            }
        }
    }

    deinit { listenerTask?.cancel() }

    func bootstrap() async {
        do {
            let session = try await supabase.auth.session
            await apply(session: session)
        } catch {
            await apply(session: nil)
        }
    }

    /// Native callback URL — must match the entry in Supabase → Auth → URL Configuration → Redirect URLs.
    static let redirectURL = URL(string: "com.iskill.app://login-callback")!

    func signInWithGitHub() async throws {
        try await supabase.auth.signInWithOAuth(
            provider: .github,
            redirectTo: Self.redirectURL,
            scopes: "read:user public_repo"
        )
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }

    /// Called from SceneDelegate / onOpenURL to complete OAuth.
    func handle(url: URL) async {
        do {
            try await supabase.auth.session(from: url)
        } catch {
            print("Auth callback failed: \(error)")
        }
    }

    // MARK: - Private

    private func apply(session: Session?) async {
        guard let session else {
            state = .signedOut
            return
        }
        let user = session.user
        let meta = user.userMetadata
        let metaLogin = meta["user_name"]?.stringValue ?? meta["preferred_username"]?.stringValue
        let emailLogin = user.email?.split(separator: "@").first.map(String.init)
        let login: String = metaLogin ?? emailLogin ?? "github_user"
        let metaName = meta["full_name"]?.stringValue ?? meta["name"]?.stringValue
        let displayName: String = metaName ?? login
        let avatar: URL? = meta["avatar_url"]?.stringValue.flatMap(URL.init(string:))
        let identity = GitHubIdentity(
            userId: user.id,
            login: login,
            displayName: displayName,
            avatarUrl: avatar,
            providerToken: session.providerToken
        )
        state = .signedIn(identity)
    }
}
