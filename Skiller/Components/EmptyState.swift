import SwiftUI

struct EmptyState: View {
    var icon: String = "sparkles"
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 42, weight: .light))
                .foregroundStyle(Color(hex: 0x3A3A48))
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.textMuted)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.textSubtle)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.vertical, 64)
    }
}
