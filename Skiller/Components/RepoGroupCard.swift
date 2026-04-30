import SwiftUI

struct RepoGroupCard: View {
    let group: RepoGroupSummary
    @State private var expanded = false
    @State private var skills: [Skill]? = nil
    @State private var loading = false

    var body: some View {
        VStack(spacing: 8) {
            Button {
                Task { await toggle() }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Image(systemName: "chevron.left.forwardslash.chevron.right")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.textSubtle)
                            Text(group.repo)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(1)
                        }
                        HStack(spacing: 4) {
                            if let stars = Format.stars(group.stars) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color(hex: 0xF5B400))
                                Text(stars)
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textSubtle)
                                Text("·")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textSubtle)
                            }
                            Text("\(Format.author(group.author)) · \(group.skillCount) 个 skill")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.textSubtle)
                        }
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.textSubtle)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.bgCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(spacing: 12) {
                    if loading {
                        ProgressView().tint(Color.brand).padding(.vertical, 16)
                    } else if let skills {
                        ForEach(skills) { SkillCard(skill: $0) }
                    }
                }
                .padding(.leading, 12)
            }
        }
    }

    @MainActor
    private func toggle() async {
        expanded.toggle()
        guard expanded, skills == nil, !loading else { return }
        let (stale, freshTask) = await SkillsCache.shared.skillsInRepo(group.repo)
        if let v = stale {
            skills = v
        } else {
            loading = true
        }
        if let v = await freshTask.value { skills = v }
        loading = false
    }
}
