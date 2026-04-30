import SwiftUI

struct SkillCardSkeleton: View {
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    bone(height: 14)
                    bone(width: 80, height: 10)
                }
                Spacer()
                Circle().fill(Color.bgElevated).frame(width: 24, height: 24)
            }
            bone(height: 10).padding(.top, 12)
            bone(width: 220, height: 10).padding(.top, 6)
            HStack(spacing: 6) {
                Capsule().fill(Color.bgElevated).frame(width: 48, height: 18)
                Capsule().fill(Color.bgElevated).frame(width: 36, height: 18)
                Capsule().fill(Color.bgElevated).frame(width: 44, height: 18)
            }
            .padding(.top, 12)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(Color.bgCard)
        .overlay(
            RoundedRectangle(cornerRadius: 16).strokeBorder(Color.borderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .opacity(pulse ? 1.0 : 0.55)
        .animation(
            .easeInOut(duration: 0.9).repeatForever(autoreverses: true),
            value: pulse
        )
        .onAppear { pulse = true }
    }

    @ViewBuilder
    private func bone(width: CGFloat? = nil, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color.bgElevated)
            .frame(width: width, height: height)
    }
}
