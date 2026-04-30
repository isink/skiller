import SwiftUI

struct HotSkillCard: View {
    let skill: Skill
    let kicker: String

    private static let categoryColors: [String: (bg: UInt32, accent: UInt32)] = [
        "official": (0x2A1E14, 0xD97757),
        "code":     (0x111C2A, 0x5B9BD5),
        "devops":   (0x141F14, 0x5EC97A),
        "data":     (0x1E1428, 0x9B6FD4),
        "design":   (0x28141E, 0xD46F9B),
        "docs":     (0x141F1F, 0x3DBDBD),
        "office":   (0x1F1F14, 0xBDBD3D),
        "research": (0x141C28, 0x5B9BD5),
        "misc":     (0x1A1A1A, 0x6B6B78),
    ]

    private var palette: (bg: Color, accent: Color) {
        let raw = Self.categoryColors[skill.category] ?? Self.categoryColors["misc"]!
        return (Color(hex: raw.bg), Color(hex: raw.accent))
    }

    var body: some View {
        NavigationLink(value: SkillRoute.detail(skill.id)) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Text(kicker)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(palette.accent)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if let stars = Format.stars(skill.githubStars) {
                        HStack(spacing: 3) {
                            Image(systemName: "star.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color(hex: 0xF5C842))
                            Text(stars)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.white.opacity(0.7))
                        }
                    }
                }
                .padding(.bottom, 14)

                Text(skill.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.95))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 6)

                Text(skill.descriptionZh ?? skill.description)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.55))
                    .lineLimit(2)
                    .lineSpacing(2)
                    .multilineTextAlignment(.leading)

                Spacer(minLength: 8)

                Text(CategoryMeta.displayName(skill.category))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(palette.accent)
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(palette.accent.opacity(0.14))
                    .clipShape(Capsule())
            }
            .padding(14)
            .frame(width: 168, height: 196, alignment: .topLeading)
            .background(palette.bg)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(palette.accent.opacity(0.45))
                    .frame(height: 2)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}
