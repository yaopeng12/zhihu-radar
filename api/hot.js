const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedItems = null;
let cachedAt = 0;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const apiKey = request.headers["x-zhihu-api-key"] || process.env.ZHIHU_API_KEY;
  const baseUrl = process.env.ZHIHU_BASE_URL || "";
  const hotListUrl = process.env.ZHIHU_HOT_LIST_URL || (baseUrl ? `${baseUrl}/content/hot_list` : "");
  const keyword = String(request.query.keyword || "").trim();

  if (!hotListUrl) {
    return response.status(501).json({
      error: "hot_list_not_configured",
      message: "请配置 ZHIHU_BASE_URL 或 ZHIHU_HOT_LIST_URL。"
    });
  }

  try {
    const now = Date.now();
    const forceRefresh = request.query.force === "1";

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && cachedItems && (now - cachedAt) < CACHE_TTL_MS) {
      const filtered = keyword
        ? cachedItems.filter((item) => item.title.includes(keyword))
        : cachedItems;

      return response.status(200).json({
        items: filtered,
        total: cachedItems.length,
        filtered: filtered.length,
        keyword: keyword || null,
        source: "Zhihu Hot List",
        updatedAt: new Date(cachedAt).toISOString(),
        cached: true
      });
    }

    // Fetch fresh data
    const raw = await fetchHotList({ apiKey, hotListUrl });
    const items = normalizeItems(raw);

    // Update cache
    cachedItems = items;
    cachedAt = now;

    const filtered = keyword
      ? items.filter((item) => item.title.includes(keyword))
      : items;

    return response.status(200).json({
      items: filtered,
      total: items.length,
      filtered: filtered.length,
      keyword: keyword || null,
      source: "Zhihu Hot List",
      updatedAt: new Date().toISOString(),
      cached: false
    });
  } catch (error) {
    // If fetch fails but we have cached data, return it
    if (cachedItems) {
      const filtered = keyword
        ? cachedItems.filter((item) => item.title.includes(keyword))
        : cachedItems;

      return response.status(200).json({
        items: filtered,
        total: cachedItems.length,
        filtered: filtered.length,
        keyword: keyword || null,
        source: "Zhihu Hot List (cached)",
        updatedAt: new Date(cachedAt).toISOString(),
        cached: true
      });
    }

    return response.status(error.statusCode || 502).json({
      error: "hot_list_failed",
      message: error.message
    });
  }
}

async function fetchHotList({ apiKey, hotListUrl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const result = await fetch(hotListUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-request-timestamp": Math.floor(Date.now() / 1000).toString(),
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      }
    });

    const text = await result.text();
    const contentType = result.headers.get("content-type") || "";

    if (!contentType.includes("json")) {
      throw new Error(
        `热榜接口返回的不是 JSON（${contentType || "未知类型"}），请检查 ZHIHU_HOT_LIST_URL 配置。`
      );
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("热榜接口返回了无法解析的 JSON。");
    }

    if (!result.ok) {
      const errMsg = body.error?.message || body.message || (typeof body.error === 'string' ? body.error : null) || `热榜接口返回 ${result.status}`;
      const error = new Error(errMsg);
      error.statusCode = result.status;
      throw error;
    }

    // Check business error code
    const code = body.Code ?? body.code;
    if (code && code !== 0 && code !== 200 && code !== "0" && code !== "200") {
      const errMsg = body.Message || body.message || body.Error || body.error || `热榜接口业务错误码 ${code}`;
      const error = new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
      error.statusCode = 502;
      throw error;
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeItems(body) {
  const raw = unwrapPayload(body);
  const list = extractItems(raw);

  return list.map((item, index) => {
    const target = item.target || item;

    return {
      rank: index + 1,
      title: stripHtml(
        target.title || target.Title || item.Title || item.title || item.Name || item.text || ""
      ),
      url: item.Url || target.url || buildUrl(target),
      excerpt: stripHtml(
        target.excerpt || target.Excerpt || item.Summary || item.excerpt || target.title || ""
      )
    };
  });
}

function unwrapPayload(payload) {
  if (payload && typeof payload === "object" && "Data" in payload) return payload.Data;
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload.Items,
    payload.items,
    payload.data,
    payload.list,
    payload.hot_list,
    payload.feed,
    payload.data?.items,
    payload.data?.list
  ];
  return candidates.find(Array.isArray) || [];
}

function buildUrl(target) {
  if (target.url) return target.url;
  if (target.id && target.type === "answer") {
    return `https://www.zhihu.com/question/${target.id}`;
  }
  if (target.id) {
    return `https://www.zhihu.com/question/${target.id}`;
  }
  return "https://www.zhihu.com/hot";
}

function parseHeat(target, item) {
  const raw = target.heat || target.hot || item.heat || item.hot || item.metrics?.heat || 0;
  if (typeof raw === "number") return raw;
  return parseNumber(raw);
}

function extractRising(detail, item) {
  if (item.rising || item.trending) return item.rising || item.trending;
  if (typeof detail === "string" && detail.includes("热度")) return "热度上升";
  if (typeof detail === "string" && detail.includes("新")) return "新上榜";
  return "";
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}
