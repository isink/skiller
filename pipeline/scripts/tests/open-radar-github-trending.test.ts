import assert from "node:assert/strict";
import test from "node:test";
import { fetchGithubTrending, parseGithubTrending, trendingUrl } from "../lib/github-trending";

const svg = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 .25"></path></svg>';

function article(options: { href: string; description?: string; language?: string; total?: string; today?: string }): string {
  const [owner, repo] = options.href.slice(1).split("/");
  return `<article class="Box-row">
  <div class="float-right d-flex"><a href="/login?return_to=${encodeURIComponent(options.href)}" class="btn">${svg} Star</a></div>
  <h2 class="h3 lh-condensed">
    <a href="${options.href}" data-view-component="true" class="Link">${svg}
      <span class="text-normal">
        ${owner} /
</span>
      ${repo}</a>  </h2>
  ${options.description === undefined ? "" : `<p class="col-9 color-fg-muted my-1 tmp-pr-4">\n      ${options.description}\n    </p>`}
  <div class="f6 color-fg-muted mt-2">
    ${options.language ? `<span class="d-inline-block"><span class="repo-language-color"></span><span itemprop="programmingLanguage">${options.language}</span></span>` : ""}
    ${options.total ? `<a href="${options.href}/stargazers" class="Link Link--muted">${svg}\n        ${options.total}</a>` : ""}
    <a href="${options.href}/forks" class="Link Link--muted">${svg}\n        825</a>
    ${options.today ? `<span class="d-inline-block float-sm-right">${svg}\n        ${options.today}\n</span>` : ""}
  </div>
</article>`;
}

const page = `<html><body><div data-hpc>
${article({ href: "/Acme/Agent-Kit", description: "Build &amp; ship <b>LLM</b> agents &#39;fast&#39;", language: "TypeScript", total: "11,410", today: "2,139 stars today" })}
${article({ href: "/someone/no-desc", total: "320", today: "45 stars today" })}
<article class="Box-row"><h2>no link here</h2></article>
<article class="Box-row"><h2><a href="/only-owner">x</a></h2></article>
${article({ href: "/Acme/Agent-Kit", description: "duplicate", today: "9 stars today" })}
</div></body></html>`;

test("parses repository, description, language and star counts", () => {
  const [first] = parseGithubTrending(page);
  assert.deepEqual(first, {
    source: "github_trending",
    sourceId: "acme/agent-kit",
    sourceUrl: "https://github.com/Acme/Agent-Kit",
    fullName: "Acme/Agent-Kit",
    title: "Agent-Kit",
    summary: "Build & ship LLM agents 'fast'",
    language: "TypeScript",
    topics: [],
    starsToday: 2139,
    starsTotal: 11410,
    votesCount: null,
  });
});

test("tolerates missing description, language and totals, and skips malformed articles", () => {
  const items = parseGithubTrending(page);
  assert.equal(items.length, 3);
  const bare = items[1];
  assert.equal(bare.fullName, "someone/no-desc");
  assert.equal(bare.summary, null);
  assert.equal(bare.language, null);
  assert.equal(bare.starsTotal, 320);
  assert.equal(bare.starsToday, 45);
});

test("returns nothing for pages without articles", () => {
  assert.deepEqual(parseGithubTrending("<html></html>"), []);
});

test("trending URL supports an optional language segment", () => {
  assert.equal(trendingUrl("daily"), "https://github.com/trending?since=daily");
  assert.equal(trendingUrl("daily", " Python "), "https://github.com/trending/python?since=daily");
  assert.equal(trendingUrl("weekly", "c++"), "https://github.com/trending/c%2B%2B?since=weekly");
});

function response(status: number, body = "", headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

test("fetch retries rate limits with a bounded delay and then parses the page", async () => {
  const urls: string[] = [];
  const sleeps: number[] = [];
  const replies = [response(429, "", { "retry-after": "2" }), response(200, page)];
  const items = await fetchGithubTrending({
    language: "python",
    fetchImpl: (async (url: string) => { urls.push(url); return replies.shift()!; }) as unknown as typeof fetch,
    sleepImpl: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(items.length, 3);
  assert.deepEqual(urls, ["https://github.com/trending/python?since=daily", "https://github.com/trending/python?since=daily"]);
  assert.deepEqual(sleeps, [2000]);
});

test("fetch gives up after repeated failures and rejects unparsable pages", async () => {
  await assert.rejects(
    fetchGithubTrending({ fetchImpl: (async () => response(503)) as unknown as typeof fetch, sleepImpl: async () => {} }),
    /503 after 4 attempts/,
  );
  await assert.rejects(
    fetchGithubTrending({ fetchImpl: (async () => response(404)) as unknown as typeof fetch }),
    /404/,
  );
  await assert.rejects(
    fetchGithubTrending({ fetchImpl: (async () => response(200, "<html>changed layout</html>")) as unknown as typeof fetch }),
    /zero repositories/,
  );
});
