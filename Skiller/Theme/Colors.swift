import SwiftUI

extension Color {
    static let bg          = Color(hex: 0x0B0B0F)
    static let bgElevated  = Color(hex: 0x14141B)
    static let bgCard      = Color(hex: 0x1A1A24)

    static let brand       = Color(hex: 0xD97757)
    static let brandLight  = Color(hex: 0xE8A084)
    static let brandDark   = Color(hex: 0xB85A3D)

    static let borderDefault = Color(hex: 0x2A2A36)
    static let borderSubtle  = Color(hex: 0x1F1F29)

    static let textPrimary = Color(hex: 0xF5F5F7)
    static let textMuted   = Color(hex: 0x9A9AA8)
    static let textSubtle  = Color(hex: 0x6B6B78)

    static let accentGreen = Color(hex: 0x8AE6A6)

    init(hex: UInt32, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >>  8) & 0xFF) / 255.0
        let b = Double( hex        & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
