import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROMOTIONS_FILE = join(process.cwd(), "data", "promotions.json");
const STATS_FILE = join(process.cwd(), "data", "stats.json");

function loadPromotions() {
  if (!existsSync(PROMOTIONS_FILE)) {
    return { platforms: [], resources: [] };
  }
  return JSON.parse(readFileSync(PROMOTIONS_FILE, "utf8"));
}

function loadStats() {
  if (!existsSync(STATS_FILE)) {
    return { views: {}, clicks: {} };
  }
  return JSON.parse(readFileSync(STATS_FILE, "utf8"));
}

function saveStats(data) {
  writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

export default async function handler(request, response) {
  const { method, query } = request;

  // GET /api/promotions - Get all config
  if (method === "GET" && !query.action) {
    const data = loadPromotions();
    return response.status(200).json(data);
  }

  // GET /api/promotions?action=match&topic=xxx - Match topic to resources
  if (method === "GET" && query.action === "match" && query.topic) {
    const data = loadPromotions();
    const topic = query.topic;
    const matched = data.resources.filter((r) =>
      r.keywords.some((k) => topic.includes(k))
    ).map((r) => {
      const platform = data.platforms.find((p) => p.id === r.platformId);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        itemCount: r.items.length,
        platform: platform ? platform.name : null
      };
    });

    return response.status(200).json({ matched });
  }

  // GET /api/promotions?action=resource&id=xxx - Get single resource
  if (method === "GET" && query.action === "resource" && query.id) {
    const data = loadPromotions();
    const resource = data.resources.find((r) => r.id === query.id);
    if (!resource) {
      return response.status(404).json({ error: "not_found" });
    }

    const platform = data.platforms.find((p) => p.id === resource.platformId);

    // Track view
    const stats = loadStats();
    stats.views[query.id] = (stats.views[query.id] || 0) + 1;
    saveStats(stats);

    return response.status(200).json({
      ...resource,
      platform: platform || null,
      views: stats.views[query.id] || 0
    });
  }

  // GET /api/promotions?action=resources - List all resources with stats
  if (method === "GET" && query.action === "resources") {
    const data = loadPromotions();
    const stats = loadStats();

    const resources = data.resources.map((r) => {
      const platform = data.platforms.find((p) => p.id === r.platformId);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        itemCount: r.items.length,
        platform: platform ? platform.name : null,
        views: stats.views[r.id] || 0
      };
    });

    return response.status(200).json({ resources });
  }

  // POST /api/promotions?action=click&id=xxx - Track click
  if (method === "POST" && query.action === "click" && query.id) {
    const stats = loadStats();
    stats.clicks[query.id] = (stats.clicks[query.id] || 0) + 1;
    saveStats(stats);
    return response.status(200).json({ success: true });
  }

  return response.status(405).json({ error: "method_not_allowed" });
}
