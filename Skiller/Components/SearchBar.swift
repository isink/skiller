import SwiftUI

struct SearchBar: View {
    @Binding var text: String
    var placeholder: LocalizedStringKey = "Search skills"

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.textSubtle)
            TextField(placeholder, text: $text)
                .foregroundStyle(Color.textPrimary)
                .tint(Color.brand)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.bgElevated)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.borderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
