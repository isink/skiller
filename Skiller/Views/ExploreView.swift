import SwiftUI

struct ExploreView: View {
    @Binding var initialCategory: String?

    @State private var mode: Mode = .repos
    @State private var category: String? = nil
    @State private var categories: [SkillCategory] = []
    @State private var counts: [String: Int] = [:]
    @State private var skills: [Skill] = []
    @State private var repos: [RepoGroupSummary] = []
    @State private var loading = true

    enum Mode: String, CaseIterable, Hashable {
        case repos = "仓库"
        case skills = "技能"
    }

    private struct LoadKey: Equatable {
        let category: String?
        let mode: Mode
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                    .padding(.top, 8)
                categoryRow
                modePicker
                contentList
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
        .background(Color.bg.ignoresSafeArea())
        .navigationBarHidden(true)
        .task {
            await loadCategories()
        }
        .task(id: LoadKey(category: category, mode: mode)) {
            await loadCurrent()
        }
        .onChange(of: initialCategory) { _, new in
            guard let new else { return }
            category = new
            mode = .skills
            initialCategory = nil
        }
        .onAppear {
            if let preset = initialCategory {
                category = preset
                mode = .skills
                initialCategory = nil
            }
        }
    }

    private var header: some View {
        HStack {
            Text("探索")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color.textPrimary)
            Spacer()
        }
    }

    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(
                    label: "全部",
                    count: counts.values.reduce(0, +),
                    active: category == nil
                ) { category = nil }
                ForEach(categories) { c in
                    CategoryChip(
                        label: CategoryMeta.displayName(c.slug),
                        icon: CategoryMeta.sfSymbol(c.slug),
                        count: counts[c.slug],
                        active: category == c.slug
                    ) { category = c.slug }
                }
            }
            .padding(.vertical, 2)
        }
        .frame(height: 36)
    }

    private var modePicker: some View {
        HStack(spacing: 8) {
            ForEach(Mode.allCases, id: \.self) { m in
                Button { mode = m } label: {
                    Text(m.rawValue)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(mode == m ? Color.textPrimary : Color.textSubtle)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(mode == m ? Color.bgCard : Color.clear)
                        .overlay(
                            Capsule().strokeBorder(
                                mode == m ? Color.borderDefault : Color.clear,
                                lineWidth: 1
                            )
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var contentList: some View {
        if loading {
            VStack(spacing: 12) {
                ForEach(0..<5, id: \.self) { _ in SkillCardSkeleton() }
            }
        } else if mode == .skills {
            if skills.isEmpty {
                EmptyState(icon: "tray", title: "还没有技能")
            } else {
                VStack(spacing: 12) {
                    ForEach(skills) { SkillCard(skill: $0) }
                }
            }
        } else {
            if repos.isEmpty {
                EmptyState(icon: "tray", title: "还没有仓库")
            } else {
                VStack(spacing: 12) {
                    ForEach(repos) { RepoGroupCard(group: $0) }
                }
            }
        }
    }

    @MainActor
    private func loadCategories() async {
        let cache = SkillsCache.shared
        let (cStale, cFresh)     = await cache.categories()
        let (cntStale, cntFresh) = await cache.categoryCounts()
        if let v = cStale   { categories = v }
        if let v = cntStale { counts = v }
        if let v = await cFresh.value   { categories = v }
        if let v = await cntFresh.value { counts = v }
    }

    @MainActor
    private func loadCurrent() async {
        switch mode {
        case .skills:
            await loadSkills()
        case .repos:
            await loadRepos()
        }
    }

    @MainActor
    private func loadSkills() async {
        let cache = SkillsCache.shared
        let pair: (stale: [Skill]?, fresh: Task<[Skill]?, Never>)
        if let cat = category {
            pair = await cache.skillsByCategory(cat, limit: 50)
        } else {
            pair = await cache.allSkills(limit: 50)
        }
        if let v = pair.stale {
            skills = v
            loading = false
        } else {
            skills = []
            loading = true
        }
        if let v = await pair.fresh.value { skills = v }
        loading = false
    }

    @MainActor
    private func loadRepos() async {
        let cache = SkillsCache.shared
        let (stale, freshTask) = await cache.repoGroups(limit: 30)
        if let v = stale {
            repos = v
            loading = false
        } else {
            repos = []
            loading = true
        }
        if let v = await freshTask.value { repos = v }
        loading = false
    }
}
