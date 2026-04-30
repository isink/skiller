import Foundation

enum CategoryMeta {
    static let order = [
        "official", "ai", "code", "data", "devops", "security",
        "design", "docs", "office", "research", "misc",
    ]

    static func displayName(_ slug: String) -> String {
        switch slug {
        case "official":  return "官方"
        case "ai":        return "AI"
        case "code":      return "编码"
        case "data":      return "数据"
        case "devops":    return "运维"
        case "security":  return "安全"
        case "design":    return "设计"
        case "docs":      return "文档"
        case "office":    return "办公"
        case "research":  return "研究"
        case "misc":      return "其他"
        default:          return slug
        }
    }

    static func sfSymbol(_ slug: String) -> String {
        switch slug {
        case "official":  return "checkmark.seal.fill"
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
