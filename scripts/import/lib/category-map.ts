/**
 * Maps raw source-category strings into our curated 9 category slugs.
 * Anything unrecognized falls into "misc".
 */

export const CURATED_CATEGORIES = [
  "official",
  "ai",
  "docs",
  "code",
  "data",
  "office",
  "design",
  "devops",
  "security",
  "research",
  "misc",
] as const;

export type CuratedCategory = (typeof CURATED_CATEGORIES)[number];

// Lower-cased substrings → target curated slug.
// Order matters: first match wins.
const RULES: Array<[RegExp, CuratedCategory]> = [
  // ── official ──────────────────────────────────────────────────────────────
  [/anthropic|official/i, "official"],

  // ── ai / agents ───────────────────────────────────────────────────────────
  [/autonomous.?agent|multi.?agent|subagent|agent.?orchestrat|agent.?manager|dispatching.*agent/i, "ai"],
  [/agent.?evaluat|evaluation.?framework|benchmark.*llm|llm.*benchmark/i, "ai"],
  [/prompt.?engineer|prompt.?optim|llm.?prompt|context.?compress|context.?window|token.?manag/i, "ai"],
  [/bdi\b|belief.?desire|mental.?state.*agent|agent.?skill|skill.?agent/i, "ai"],
  [/mcp.?server|model.?context.?protocol/i, "ai"],

  // ── security / offensive ─────────────────────────────────────────────────
  [/pentest|penetration.?test|red.?team|exploit|payload|ctf\b|bug.?bounty/i, "security"],
  [/sqli|sql.?inject|xss\b|cross.?site|path.?traversal|directory.?traversal|lfi\b|rfi\b/i, "security"],
  [/privilege.?escalat|priv.?esc|lateral.?movement|post.?exploit/i, "security"],
  [/fuzzing|fuzz\b|ffuf|burpsuite|metasploit|mimikatz|bloodhound|cobalt.?strike/i, "security"],
  [/shodan|reconnaissance|recon\b|osint|footprint/i, "security"],
  [/active.?directory.*attack|kerberos|pass.?the.?hash|golden.?ticket/i, "security"],
  [/memory.?forensic|malware.?anal|reverse.?engineer.*binary|firmware.?anal|protocol.?revers/i, "security"],
  [/solidity.?secur|smart.?contract.?secur|pci.?dss|stride.?threat|threat.?model/i, "security"],
  [/vulnerability.?scan|vuln.?assess|semgrep.?rule|sast\b|dast\b|owasp/i, "security"],
  [/cred.*manag.*secur|secret.*vault|1password|credential.?delet/i, "security"],
  [/smtp.*pentest|smtp.*test.*secur|linux.*privilege|windows.*privilege/i, "security"],

  // ── office / productivity ─────────────────────────────────────────────────
  [/pdf|docx|xlsx|pptx|word|excel|powerpoint|spreadsheet|presentation|slide/i, "office"],
  [/email|gmail|outlook|calendar|meeting|schedule|notion|jira|confluence|ticket|todo|task|trello|asana|clickup|project.?manage/i, "office"],
  [/slack|teams|zoom|discord|telegram|wechat|dingtalk|lark|feishu/i, "office"],
  [/invoice|receipt|contract|legal|compliance|hr|recruit|hiring|resume|cv/i, "office"],
  [/productivity|workflow|automat|templat/i, "office"],
  // CRM / marketing platforms
  [/hubspot|salesforce|crm\b|activecampaign|klaviyo|mailchimp|bamboohr|zendesk|intercom|freshdesk|helpdesk/i, "office"],
  [/make\.com|integromat|n8n\b|pagerduty|shopify.?develop|wordpress.?develop/i, "office"],
  [/linkedin.*automat|instagram.*automat|youtube.*automat|facebook.*automat|twitter.*automat|x\.com.*automat/i, "office"],
  [/social.*orches|social.*schedul|social.*content.*platform/i, "office"],

  // ── docs / writing ────────────────────────────────────────────────────────
  [/doc|docs|writing|readme|markdown|wiki|note|memo|blog|article|report|summariz|translat|proofread|grammar|copywrite|content.?creat|changelog|newsletter/i, "docs"],
  [/comms|communicat|editor|draft|rewrite|paraphrase/i, "docs"],

  // ── code / engineering ────────────────────────────────────────────────────
  [/code|coding|program|develop|engineer|software|hack|script|snippet/i, "code"],
  [/refactor|lint|test|debug|review|pr|pull.?request|commit|diff|patch/i, "code"],
  [/typescript|javascript|python|rust|golang|ruby|php|kotlin|swift|scala|elixir|haskell|cpp|c\+\+|java\b|\.net|csharp/i, "code"],
  [/react|vue|angular|svelte|nextjs|nuxt|remix|tailwind|html|css|sass|scss|dom|frontend|front.?end/i, "code"],
  [/node|express|fastapi|django|flask|rails|spring|backend|back.?end|api|rest|graphql|grpc|websocket/i, "code"],
  [/git\b|github|gitlab|bitbucket|svn|version.?control/i, "code"],
  [/regex|json|yaml|xml|csv|parser|compiler|interpreter|algorithm|data.?struct/i, "code"],
  [/npm|yarn|pip|cargo|gem|brew|package|dependency|module|library|framework/i, "code"],
  [/unit.?test|e2e|jest|pytest|cypress|playwright|selenium|mocha|vitest/i, "code"],
  [/mobile|ios|android|react.?native|flutter|swift\b|kotlin/i, "code"],

  // ── data / analytics ─────────────────────────────────────────────────────
  [/data|sql|analytics|analys|statistic|metric|kpi|dashboard|report/i, "data"],
  [/pandas|numpy|scipy|matplotlib|seaborn|plotly|tableau|powerbi|looker/i, "data"],
  [/database|postgres|mysql|sqlite|mongodb|redis|elasticsearch|supabase|firebase/i, "data"],
  [/etl|pipeline|ingestion|warehouse|datalake|bigquery|snowflake|dbt|spark|airflow/i, "data"],
  [/ml|machine.?learn|deep.?learn|neural|model|train|inference|embed|vector|rag|llm|nlp|cv\b|vision/i, "data"],
  [/forecast|predict|classif|cluster|anomal|sentiment|recommend/i, "data"],
  [/chart|graph|visual|plot|diagram|insight/i, "data"],

  // ── design / creative ─────────────────────────────────────────────────────
  [/design|ui\b|ux\b|figma|sketch|adobe|photoshop|illustrator|canva|brand|logo/i, "design"],
  [/image|photo|picture|video|animation|motion|3d|render|icon|font|typography|color|palette/i, "design"],
  [/css|tailwind|style|theme|dark.?mode|responsive|accessibility|a11y/i, "design"],
  [/art|creative|generat|stable.?diff|midjourney|dall.?e|comfyui/i, "design"],

  // ── devops / infrastructure ───────────────────────────────────────────────
  [/devops|docker|k8s|kubernetes|helm|container|pod|cluster/i, "devops"],
  [/terraform|ansible|puppet|chef|pulumi|infra|infrastructure|iac/i, "devops"],
  [/ci\b|cd\b|cicd|github.?action|gitlab.?ci|jenkins|circle.?ci|deploy|release|pipeline/i, "devops"],
  [/aws|gcp|azure|cloud|lambda|serverless|ec2|s3\b|gke|eks|aks/i, "devops"],
  [/nginx|apache|linux|ubuntu|debian|centos|shell|bash|zsh|terminal|ssh|firewall|network/i, "devops"],
  [/monitor|log|alert|observ|metric|trace|grafana|prometheus|datadog|sentry/i, "devops"],
  [/mcp|server|proxy|gateway|loadbalanc|dns|ssl|cert/i, "devops"],
  [/\bauth\b|oauth|jwt|encrypt|firewall|secret.?manag/i, "devops"],

  // ── research / information ────────────────────────────────────────────────
  [/research|paper|citation|academic|literature|arxiv|scholar|journal|survey/i, "research"],
  [/search|web|browse|crawl|scrape|fetch|news|information|knowledg|fact.?check|wikipedia/i, "research"],
  [/interview|question|answer|quiz|exam|study|learn|tutor|education|teach|explain/i, "research"],
  [/market|competi|trend|insight|analysis|business.?intel/i, "research"],
  [/travel|map|location|weather|flight|hotel/i, "research"],
  // SEO / growth / marketing
  [/\bseo\b|serp\b|keyword.?research|backlink|programmatic.?seo|seo.?snippet|seo.?programmat/i, "research"],
  [/growth.?hack|growth.?engine|lead.?generat|lead.?magnet|\bcro\b|conversion.?rate|landing.?page/i, "research"],
  [/saas.*mvp|product.?manager|product.?manage|monetiz|sales.?enabl|competitive.?landscape/i, "research"],
  [/personal.?brand|content.?strateg|apify.?trend|apify.?lead/i, "research"],
];

export function mapCategory(raw: string | null | undefined): CuratedCategory {
  if (!raw) return "misc";
  const lower = raw.toLowerCase();
  if (CURATED_CATEGORIES.includes(lower as CuratedCategory)) {
    return lower as CuratedCategory;
  }
  for (const [rx, target] of RULES) {
    if (rx.test(lower)) return target;
  }
  return "misc";
}
