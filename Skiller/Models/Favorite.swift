import Foundation
import SwiftData

@Model
final class Favorite {
    @Attribute(.unique) var skillId: String
    var createdAt: Date

    init(skillId: String, createdAt: Date = .now) {
        self.skillId = skillId
        self.createdAt = createdAt
    }
}

@Model
final class LastSeen {
    @Attribute(.unique) var key: String
    var seenAt: Date

    init(key: String, seenAt: Date = .now) {
        self.key = key
        self.seenAt = seenAt
    }
}

@Model
final class RecentView {
    @Attribute(.unique) var skillId: String
    var category: String
    var viewedAt: Date

    init(skillId: String, category: String, viewedAt: Date = .now) {
        self.skillId = skillId
        self.category = category
        self.viewedAt = viewedAt
    }
}
