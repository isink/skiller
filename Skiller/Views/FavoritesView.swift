import SwiftData
import SwiftUI

struct FavoritesView: View {
    @Query(sort: \Favorite.createdAt, order: .reverse) private var favorites: [Favorite]
    @State private var skills: [Skill] = []
    @State private var loading = true

    var body: some View {
        Group {
            if favorites.isEmpty {
                EmptyState(icon: "heart", title: "No favorites yet", subtitle: "Tap the heart icon on a skill page to favorite it")
            } else if loading {
                LazyVStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in SkillCardSkeleton() }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(skills) { SkillCard(skill: $0) }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 32)
                }
            }
        }
        .background(Color.bg.ignoresSafeArea())
        .navigationTitle("Favorites")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.bg, for: .navigationBar)
        .task(id: favorites.map(\.skillId)) { await loadSkills() }
    }

    @MainActor
    private func loadSkills() async {
        loading = true
        defer { loading = false }
        var loaded: [Skill] = []
        for fav in favorites {
            if let s = try? await SkillsAPI.fetchSkillById(fav.skillId) {
                loaded.append(s)
            }
        }
        skills = loaded
    }
}
