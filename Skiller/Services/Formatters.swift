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
        case "community":  return "社区"
        default:           return a
        }
    }

    static func timeAgo(_ iso: String?) -> String {
        guard let iso, let date = parseISO(iso) else { return "" }
        let days = Int(Date().timeIntervalSince(date) / 86400)
        if days <= 0  { return "今天" }
        if days == 1  { return "昨天" }
        if days < 7   { return "\(days)天前" }
        if days < 30  { return "\(days / 7)周前" }
        return "\(days / 30)个月前"
    }

    static func timeAgoShort(_ date: Date?) -> String {
        guard let date else { return "" }
        let mins = max(0, Int(Date().timeIntervalSince(date) / 60))
        if mins < 60   { return "\(mins)分钟前" }
        let hours = mins / 60
        if hours < 24  { return "\(hours)小时前" }
        return "\(hours / 24)天前"
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
