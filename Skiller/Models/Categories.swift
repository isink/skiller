import Foundation

enum CategoryMeta {
    static let order = [
        "official", "mp-skill", "ai", "code", "data", "devops", "security",
        "design", "docs", "office", "research", "misc",
    ]

    static func displayName(_ slug: String, serverName: String? = nil) -> String {
        switch slug {
        case "official":  return String(localized: "Official")
        case "mp-skill":  return "微信小程序 SKILL"
        case "ai":        return "AI"
        case "code":      return String(localized: "Coding")
        case "data":      return String(localized: "Data")
        case "devops":    return String(localized: "DevOps")
        case "security":  return String(localized: "Security")
        case "design":    return String(localized: "Design")
        case "docs":      return String(localized: "Docs")
        case "office":    return String(localized: "Office")
        case "research":  return String(localized: "Research")
        case "misc":      return String(localized: "Other")
        default:
            if let name = serverName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
                return name
            }
            return slug
        }
    }

    static func sfSymbol(_ slug: String) -> String {
        switch slug {
        case "official":  return "checkmark.seal.fill"
        case "mp-skill":  return "sparkles"
        case "ai":        return "sparkles"
        case "code":      return "chevron.left.forwardslash.chevron.right"
        case "data":      return "chart.bar.fill"
        case "devops":    return "gearshape.2.fill"
        case "security":  return "lock.shield.fill"
        case "design":    return "paintbrush.fill"
        case "docs":      return "doc.text.fill"
        case "office":    return "briefcase.fill"
        case "research":  return "magnifyingglass"
        default:          return "square.grid.2x2.fill"
        }
    }
}
