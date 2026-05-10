import Foundation

enum Format {

    static func stars(_ n: Int?) -> String? {
        guard let n, n > 0 else { return nil }
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000     { return String(format: "%.1fk", Double(n) / 1_000) }
        return String(n)
    }

    static func author(_ a: String) -> String {
        switch a {
        case "anthropics": return "Anthropic"
        case "community":  return String(localized: "Community")
        default:           return a
        }
    }

    static func timeAgo(_ iso: String?) -> String {
        guard let iso, let date = parseISO(iso) else { return "" }
        let days = Int(Date().timeIntervalSince(date) / 86400)
        if days <= 0 { return String(localized: "Today") }
        if days == 1 { return String(localized: "Yesterday") }
        if days < 7  { return String(localized: "\(days) days ago") }
        if days < 30 {
            let weeks = days / 7
            return weeks == 1
                ? String(localized: "1 week ago")
                : String(localized: "\(weeks) weeks ago")
        }
        let months = days / 30
        return months == 1
            ? String(localized: "1 month ago")
            : String(localized: "\(months) months ago")
    }

    static func timeAgoShort(_ date: Date?) -> String {
        guard let date else { return "" }
        let mins = max(0, Int(Date().timeIntervalSince(date) / 60))
        if mins < 60 { return String(localized: "\(mins) minutes ago") }
        let hours = mins / 60
        if hours < 24 { return String(localized: "\(hours) hours ago") }
        let days = hours / 24
        return days == 1
            ? String(localized: "Yesterday")
            : String(localized: "\(days) days ago")
    }

    static func count(_ n: Int) -> String {
        if n >= 1_000 { return String(format: "%.1fk", Double(n) / 1_000) }
        return String(n)
    }

    private static let isoParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoParserNoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parseISO(_ s: String) -> Date? {
        isoParser.date(from: s) ?? isoParserNoFrac.date(from: s)
    }
}
