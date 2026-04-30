import GoogleMobileAds
import SwiftData
import SwiftUI

@main
struct SkillerApp: App {
    @StateObject private var auth = AuthService.shared

    init() {
        MobileAds.shared.start(completionHandler: nil)
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .preferredColorScheme(.dark)
                .environmentObject(auth)
                .task { await auth.bootstrap() }
                .onOpenURL { url in
                    Task { await auth.handle(url: url) }
                }
        }
        .modelContainer(for: [Favorite.self, LastSeen.self, RecentView.self])
    }
}
