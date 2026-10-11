const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const command = db.command;
const SKILLS = "skills";
const CATEGORIES = "categories";
const MAX_LIMIT = 50;
const SKILL_LIST_FIELDS = {
  id: true,
  slug: true,
  name: true,
  description: true,
  description_zh: true,
  category: true,
  tags: true,
  use_cases: true,
  author: true,
  github_url: true,
  github_stars: true,
  rank: true,
  score: true,
  featured: true,
  created_at: true,
  published_at: true,
};

function asSkill(doc) {
  return { ...doc, id: doc.id || doc._id };
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listSkills(filter, offset, limit, orderBy) {
  let query = db.collection(SKILLS).where(filter).field(SKILL_LIST_FIELDS);
  if (orderBy === "created_at") {
    query = query.orderBy("created_at", "desc");
  } else {
    query = query.orderBy("github_stars", "desc").orderBy("rank", "desc");
  }
  const result = await query.skip(offset).limit(limit).get();
  return result.data.map(asSkill);
}

exports.main = async (event = {}) => {
  switch (event.action) {
    case "featured": {
      const limit = boundedInteger(event.limit, 20, 1, MAX_LIMIT);
      const result = await db.collection(SKILLS)
        .where({ featured: true })
        .field(SKILL_LIST_FIELDS)
        .orderBy("rank", "desc")
        .limit(limit)
        .get();
      return result.data.map(asSkill);
    }
    case "categories": {
      const result = await db.collection(CATEGORIES).orderBy("slug", "asc").get();
      return result.data.map(({ _id, ...category }) => ({ ...category, id: category.id || _id }));
    }
    case "categoryCounts": {
      const categories = await db.collection(CATEGORIES).field({ slug: true }).get();
      const pairs = await Promise.all(categories.data.map(async ({ slug }) => {
        const result = await db.collection(SKILLS).where({ category: slug }).count();
        return [slug, result.total];
      }));
      return Object.fromEntries(pairs);
    }
    case "skills": {
      const category = typeof event.category === "string" ? event.category : "";
      const filter = category ? { category } : {};
      return listSkills(
        filter,
        boundedInteger(event.offset, 0, 0, 100000),
        boundedInteger(event.limit, 30, 1, MAX_LIMIT),
        event.orderBy === "created_at" ? "created_at" : "github_stars",
      );
    }
    case "search": {
      const query = typeof event.query === "string" ? event.query.trim().slice(0, 80) : "";
      if (!query) return [];
      const matcher = db.RegExp({ regexp: escapedRegex(query), options: "i" });
      const result = await db.collection(SKILLS)
        .where(command.or([
          { name: matcher },
          { description: matcher },
          { description_zh: matcher },
          { author: matcher },
        ]))
        .field(SKILL_LIST_FIELDS)
        .orderBy("rank", "desc")
        .limit(MAX_LIMIT)
        .get();
      return result.data.map(asSkill);
    }
    case "skill": {
      const id = typeof event.id === "string" ? event.id : "";
      if (!id || id.length > 128) return null;
      try {
        const result = await db.collection(SKILLS).doc(id).get();
        return asSkill(result.data);
      } catch (error) {
        if (error && (error.errCode === -1 || error.code === "DOCUMENT_NOT_FOUND")) return null;
        throw error;
      }
    }
    case "skillsByIds": {
      const ids = Array.isArray(event.ids)
        ? [...new Set(event.ids.filter((id) => typeof id === "string" && id.length <= 128))].slice(0, 100)
        : [];
      if (!ids.length) return [];
      const result = await db.collection(SKILLS)
        .where({ _id: command.in(ids) })
        .field(SKILL_LIST_FIELDS)
        .limit(100)
        .get();
      return result.data.map(asSkill);
    }
    default:
      throw new Error("不支持的数据操作");
  }
};
