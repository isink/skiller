import Foundation

struct GitHubRepo: Identifiable, Decodable, Equatable {
    let id: Int
    let name: String
    let fullName: String
    let description: String?
    let htmlUrl: URL
    let stargazersCount: Int
    let language: String?
    let updatedAt: String
    let isPrivate: Bool
    let fork: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, description, language, fork
        case fullName = "full_name"
        case htmlUrl = "html_url"
        case stargazersCount = "stargazers_count"
        case updatedAt = "updated_at"
        case isPrivate = "private"
    }
}

enum GitHubAPI {
    /// Lists the signed-in user's own public repos, newest-updated first.
    /// `public_repo` scope is enough — private repos would need `repo` scope.
    static func listMyRepos(token: String) async throws -> [GitHubRepo] {
        var comps = URLComponents(string: "https://api.github.com/user/repos")!
        comps.queryItems = [
            URLQueryItem(name: "sort", value: "updated"),
            URLQueryItem(name: "per_page", value: "100"),
            URLQueryItem(name: "affiliation", value: "owner"),
            URLQueryItem(name: "visibility", value: "public"),
        ]
        var req = URLRequest(url: comps.url!)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        req.setValue("2022-11-28", forHTTPHeaderField: "X-GitHub-Api-Version")

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw URLError(.init(rawValue: http.statusCode))
        }
        return try JSONDecoder().decode([GitHubRepo].self, from: data)
    }
}
