import Foundation

struct Skill: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let description: String
    let descriptionZh: String?
    let category: String
    let tags: [String]
    let useCases: [String]?
    let author: String
    let githubUrl: String
    let githubStars: Int?
    let rank: Int
    let score: Int
    let featured: Bool
    let createdAt: String
    let publishedAt: String?
    let skillMdContent: String?
    let installCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description, category, tags, author, rank, score, featured
        case descriptionZh    = "description_zh"
        case useCases         = "use_cases"
        case githubUrl        = "github_url"
        case githubStars      = "github_stars"
        case createdAt        = "created_at"
        case publishedAt      = "published_at"
        case skillMdContent   = "skill_md_content"
        case installCount     = "install_count"
    }
}

struct SkillCategory: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let icon: String
}

struct RepoGroupSummary: Codable, Identifiable, Hashable {
    var id: String { repo }
    let repo: String
    let author: String
    let stars: Int?
    let skillCount: Int
    let repSkillId: String

    enum CodingKeys: String, CodingKey {
        case repo, author, stars
        case skillCount = "skill_count"
        case repSkillId = "rep_skill_id"
    }
}

struct HomeStats {
    let total: Int
    let newToday: Int
    let lastSyncAt: Date?
}
