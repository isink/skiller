import XCTest
@testable import Skiller

final class CategoryMetaTests: XCTestCase {
    func testMiniProgramSkillCategory() {
        XCTAssertEqual(CategoryMeta.displayName("mp-skill"), "微信小程序 SKILL")
        XCTAssertEqual(CategoryMeta.sfSymbol("mp-skill"), "sparkles")
        XCTAssertTrue(CategoryMeta.order.contains("mp-skill"))
    }

    func testKnownCategoryIgnoresServerName() {
        XCTAssertEqual(CategoryMeta.displayName("ai", serverName: "Something Else"), "AI")
    }

    func testUnknownCategoryPrefersServerName() {
        XCTAssertEqual(CategoryMeta.displayName("new-cat", serverName: "新分类"), "新分类")
    }

    func testUnknownCategoryFallsBackToSlug() {
        XCTAssertEqual(CategoryMeta.displayName("new-cat"), "new-cat")
        XCTAssertEqual(CategoryMeta.displayName("new-cat", serverName: "  "), "new-cat")
    }
}
