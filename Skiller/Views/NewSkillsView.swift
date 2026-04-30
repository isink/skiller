import SwiftUI

struct NewSkillsView: View {
    @State private var category: String? = nil
    @State private var allCategories: [SkillCategory] = []
    @State private var batch: [Skill] = []
    @State private var loading = true

    /// Categories actually present in this batch.
    private var batchCategoryCounts: [String: Int] {
        var d: [String: Int] = [:]
        for s in batch { d[s.category, default: 0] += 1 }
        return d
    }

    private var availableCategories: [SkillCategory] {
        allCategories.filter { (batchCategoryCounts[$0.slug] ?? 0) > 0 }
    }

    private var visibleSkills: [Skill] {
        let filtered = category.map { cat in batch.filter { $0.category == cat } } ?? batch
        return filtered.sorted { ($0.githubStars ?? -1) > ($1.githubStars ?? -1) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !batch.isEmpty {
                    categoryRow
                }
                contentList
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
        .background(Color.bg.ignoresSafeArea())
        .navigationTitle("最新收录")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.bg, for: .navigationBar)
        .task { await loadCategories() }
        .task { await loadBatch() }
    }

    private var header: some View {
        let count = batch.count
        let when = batch.first.flatMap { Format.parseISO($0.createdAt) }
        return HStack(spacing: 6) {
            if count > 0 {
                Text("本次收录 \(count) 个 · 按 ★ 排序")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textSubtle)
                if let when {
                    Text("·")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSubtle)
                    Text(Format.timeAgoShort(when))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSubtle)
                }
            }
            Spacer()
        }
    }

    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(
                    label: "全部",
                    count: batch.count,
                    active: category == nil
                ) { category = nil }
                ForEach(availableCategories) { c in
                    CategoryChip(
                        label: CategoryMeta.displayName(c.slug),
                        icon: CategoryMeta.sfSymbol(c.slug),
                        count: batchCategoryCounts[c.slug],
                        active: category == c.slug
                    ) { category = c.slug }
                }
            }
            .padding(.vertical, 2)
        }
        .frame(height: 36)
    }

    @ViewBuilder
    private var contentList: some View {
        if loading {
            VStack(spacing: 12) {
                ForEach(0..<6, id: \.self) { _ in SkillCardSkeleton() }
            }
        } else if visibleSkills.isEmpty {
            EmptyState(icon: "tray", title: "本次没有收录")
        } else {
            VStack(spacing: 12) {
                ForEach(visibleSkills) { SkillCard(skill: $0) }
            }
        }
    }

    @MainActor
    private func loadCategories() async {
        let cache = SkillsCache.shared
        let (cStale, cFresh) = await cache.categories()
        if let v = cStale { allCategories = v }
        if let v = await cFresh.value { allCategories = v }
    }

    @MainActor
    private func loadBatch() async {
        let cache = SkillsCache.shared
        let (stale, freshTask) = await cache.latestBatch()
        if let v = stale {
            batch = v
            loading = false
        } else {
            batch = []
            loading = true
        }
        if let v = await freshTask.value { batch = v }
        loading = false
    }
}
