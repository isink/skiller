import Foundation
import SwiftData
import SwiftUI

@MainActor
final class FavoritesStore {
    private var context: ModelContext

    init(_ context: ModelContext) {
        self.context = context
    }

    func isFavorite(_ skillId: String) -> Bool {
        var fd = FetchDescriptor<Favorite>(
            predicate: #Predicate { $0.skillId == skillId }
        )
        fd.fetchLimit = 1
        return ((try? context.fetch(fd))?.first) != nil
    }

    func toggle(_ skillId: String) {
        var fd = FetchDescriptor<Favorite>(
            predicate: #Predicate { $0.skillId == skillId }
        )
        fd.fetchLimit = 1
        if let existing = (try? context.fetch(fd))?.first {
            context.delete(existing)
        } else {
            context.insert(Favorite(skillId: skillId))
        }
        try? context.save()
    }
}

@MainActor
enum RecentViewStore {
    static func record(_ ctx: ModelContext, skillId: String, category: String) {
        var fd = FetchDescriptor<RecentView>(
            predicate: #Predicate { $0.skillId == skillId }
        )
        fd.fetchLimit = 1
        if let existing = (try? ctx.fetch(fd))?.first {
            existing.viewedAt = .now
            existing.category = category
        } else {
            ctx.insert(RecentView(skillId: skillId, category: category))
        }
        try? ctx.save()
    }
}

@MainActor
final class LastSeenStore {
    static let exploreKey = "explore"
    private var context: ModelContext

    init(_ context: ModelContext) { self.context = context }

    func get(_ key: String) -> Date? {
        var fd = FetchDescriptor<LastSeen>(
            predicate: #Predicate { $0.key == key }
        )
        fd.fetchLimit = 1
        return (try? context.fetch(fd))?.first?.seenAt
    }

    func update(_ key: String, to date: Date = .now) {
        var fd = FetchDescriptor<LastSeen>(
            predicate: #Predicate { $0.key == key }
        )
        fd.fetchLimit = 1
        if let existing = (try? context.fetch(fd))?.first {
            existing.seenAt = date
        } else {
            context.insert(LastSeen(key: key, seenAt: date))
        }
        try? context.save()
    }
}
