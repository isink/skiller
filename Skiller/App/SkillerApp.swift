import GoogleMobileAds
import SwiftData
import SwiftUI
import UIKit

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
                .onReceive(
                    NotificationCenter.default.publisher(
                        for: UIApplication.didBecomeActiveNotification)
                ) { _ in
                    Task { await recordAppOpen() }
                }
        }
        .modelContainer(for: [Favorite.self, LastSeen.self, RecentView.self])
    }

    private func recordAppOpen() async {
        guard let deviceId = await UIDevice.current.identifierForVendor?.uuidString else { return }
        try? await supabase
            .from("app_opens")
            .insert(["device_id": deviceId])
            .execute()
    }
}
