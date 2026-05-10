import SwiftUI

/// Compact pagination control: ← Prev | Page N / M | Next →
struct Pagination: View {
    @Binding var currentPage: Int      // 0-based
    let totalPages: Int
    var onChange: () -> Void = {}

    var body: some View {
        HStack(spacing: 16) {
            navButton(systemName: "chevron.left", disabled: currentPage <= 0) {
                if currentPage > 0 {
                    currentPage -= 1
                    onChange()
                }
            }

            Text("Page \(currentPage + 1) / \(totalPages)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.textMuted)
                .monospacedDigit()
                .frame(minWidth: 100)

            navButton(systemName: "chevron.right", disabled: currentPage >= totalPages - 1) {
                if currentPage < totalPages - 1 {
                    currentPage += 1
                    onChange()
                }
            }
        }
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func navButton(systemName: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(disabled ? Color.textSubtle.opacity(0.4) : Color.textPrimary)
                .frame(width: 36, height: 36)
                .background(disabled ? Color.bgCard.opacity(0.5) : Color.bgCard)
                .overlay(
                    Circle().strokeBorder(disabled ? Color.borderSubtle.opacity(0.5) : Color.borderDefault, lineWidth: 1)
                )
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}
