import SwiftUI

struct CategoryChip: View {
    let label: String
    var icon: String? = nil
    var count: Int? = nil
    var newCount: Int? = nil
    var active: Bool = false
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(active ? Color.brandLight : Color.textSubtle)
                }
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(active ? Color.brandLight : Color.textMuted)

                if let count {
                    Text(Format.count(count))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(active ? Color.brandLight : Color.textSubtle)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(active ? Color.brand.opacity(0.3) : Color.bgCard)
                        .clipShape(Capsule())
                        .padding(.leading, 2)
                }

                if let newCount, newCount > 0 {
                    Text("+\(Format.count(newCount))")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.36, green: 0.85, blue: 0.51))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(active ? Color.brand.opacity(0.2) : Color.bgElevated)
            .overlay(
                Capsule().strokeBorder(active ? Color.brand : Color.borderSubtle, lineWidth: 1)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
