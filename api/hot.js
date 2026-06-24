const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cache per platform
const cache = {};

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const platform = String(request.query.platform || "zhihu");
  const keyword = String(request.query.keyword || "").trim();
  const forceRefresh = request.query.force === "1";

  try {
    const now = Date.now();
    const cacheKey = platform;

    // Use cache if valid
    if (!forceRefresh && cache[cacheKey] && (now - cache[cacheKey].time) < CACHE_TTL_MS) {
      const items = keyword
        ? cache[cacheKey].items.filter(i => i.title.includes(keyword))
        : cache[cacheKey].items;

      return response.status(200).json({
        platform,
        items,
        total: cache[cacheKey].items.length,
        filtered: items.length,
        source: cache[cacheKey].source,
        updatedAt: new Date(cache[cacheKey].time).toISOString(),
        cached: true
      });
    }

    // Fetch fresh data
    const { items, source } = await fetchHotList(platform);

    // Update cache
    cache[cacheKey] = { items, source, time: now };

    const filtered = keyword
      ? items.filter(i => i.title.includes(keyword))
      : items;

    return response.status(200).json({
      platform,
      items: filtered,
      total: items.length,
      filtered: filtered.length,
      source,
      updatedAt: new Date().toISOString(),
      cached: false
    });
  } catch (error) {
    // Fallback to cache if available
    if (cache[platform]) {
      const items = keyword
        ? cache[platform].items.filter(i => i.title.includes(keyword))
        : cache[platform].items;

      return response.status(200).json({
        platform,
        items,
        total: cache[platform].items.length,
        filtered: items.length,
        source: cache[platform].source + " (cached)",
        updatedAt: new Date(cache[platform].time).toISOString(),
        cached: true
      });
    }

    return response.status(error.statusCode || 502).json({
      error: "hot_list_failed",
      message: error.message
    });
  }
}

async function fetchHotList(platform) {
  const fetchers = {
    zhihu: fetchZhihu,
    weibo: fetchWeibo,
    baidu: fetchBaidu,
    douyin: fetchDouyin,
    bilibili: fetchBilibili
  };

  const fetcher = fetchers[platform];
  if (!fetcher) {
    throw new Error(`不支持的平台: ${platform}`);
  }

  return fetcher();
}

// 知乎热榜
async function fetchZhihu() {
  // Try official Zhihu developer API first
  const apiKey = process.env.ZHIHU_API_KEY;
  const baseUrl = process.env.ZHIHU_BASE_URL || "";
  const url = process.env.ZHIHU_HOT_LIST_URL || (baseUrl ? `${baseUrl}/content/hot_list` : "");

  if (url) {
    try {
      const data = await fetchJSON(url, {
        headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {}
      });

      const code = data.Code ?? data.code;
      if (!code || code === 0 || code === 200) {
        let rawItems = [];
        if (Array.isArray(data.Data?.Items)) rawItems = data.Data.Items;
        else if (Array.isArray(data.Data?.items)) rawItems = data.Data.items;
        else if (Array.isArray(data.Data)) rawItems = data.Data;
        else if (Array.isArray(data.items)) rawItems = data.items;
        else if (Array.isArray(data.Items)) rawItems = data.Items;

        if (rawItems.length > 0) {
          const items = rawItems.map((item, i) => ({
            rank: i + 1,
            title: item.Title || item.title || item.target?.title || "",
            url: item.Url || item.url || item.target?.url || "",
            excerpt: item.Summary || item.excerpt || item.target?.excerpt || ""
          }));
          return { items, source: "知乎热榜" };
        }
      }
    } catch (e) {
      console.error("Zhihu official API failed, trying fallback:", e.message);
    }
  }

  // Fallback: use DailyHot API
  const data = await fetchJSON("https://api.codelife.cc/api/top/list?lang=cn&id=mproPpoq6O");
  const items = (data.data || []).map((item, i) => ({
    rank: i + 1,
    title: item.title || "",
    url: item.url || item.link || `https://www.zhihu.com/search?q=${encodeURIComponent(item.title || "")}`,
    excerpt: item.desc || item.excerpt || ""
  }));

  return { items, source: "知乎热榜" };
}

// 微博热搜
async function fetchWeibo() {
  try {
    const data = await fetchJSON("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "referer": "https://weibo.com/"
      }
    });

    const items = (data.data?.realtime || []).map((item, i) => ({
      rank: i + 1,
      title: item.note || item.word || "",
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.note || item.word)}`,
      excerpt: item.category || "",
      hot: item.num || 0
    }));

    return { items, source: "微博热搜" };
  } catch (e) {
    // Fallback: try alternative API
    try {
      const data = await fetchJSON("https://tenapi.cn/v2/weibohot");
      const items = (data.data || []).map((item, i) => ({
        rank: i + 1,
        title: item.name || "",
        url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.name)}`,
        excerpt: "",
        hot: item.hot || 0
      }));
      return { items, source: "微博热搜" };
    } catch {
      throw e;
    }
  }
}

// 百度热搜
async function fetchBaidu() {
  try {
    const data = await fetchJSON("https://top.baidu.com/api/board?platform=wise&tab=realtime", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const items = (data.data?.cards?.[0]?.content || []).map((item, i) => ({
      rank: i + 1,
      title: item.word || item.query || "",
      url: item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.query)}`,
      excerpt: item.desc || "",
      hot: item.hotScore || 0
    }));
    return { items, source: "百度热搜" };
  } catch (e) {
    // Fallback: try alternative API
    try {
      const data = await fetchJSON("https://tenapi.cn/v2/baiduhot");
      const items = (data.data || []).map((item, i) => ({
        rank: i + 1,
        title: item.name || "",
        url: item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(item.name)}`,
        excerpt: "",
        hot: item.hot || 0
      }));
      return { items, source: "百度热搜" };
    } catch {
      return { items: [], source: "百度热搜" };
    }
  }
}

// 抖音热榜
async function fetchDouyin() {
  try {
    const data = await fetchJSON("https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const items = (data.data?.word_list || []).map((item, i) => ({
      rank: i + 1,
      title: item.word || "",
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`,
      excerpt: item.sentence_tag?.toString() || "",
      hot: item.hot_value || 0
    }));
    return { items, source: "抖音热榜" };
  } catch (e) {
    // Fallback: try alternative API
    try {
      const data = await fetchJSON("https://tenapi.cn/v2/douyinhot");
      const items = (data.data || []).map((item, i) => ({
        rank: i + 1,
        title: item.name || "",
        url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.name)}`,
        excerpt: "",
        hot: item.hot || 0
      }));
      return { items, source: "抖音热榜" };
    } catch {
      return { items: [], source: "抖音热榜" };
    }
  }
}

// B站热榜
async function fetchBilibili() {
  const data = await fetchJSON("https://api.bilibili.com/x/web-interface/search/square?limit=50");

  const items = (data.data?.trending?.list || []).map((item, i) => ({
    rank: i + 1,
    title: item.keyword || item.show_name || "",
    url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword || item.show_name)}`,
    excerpt: "",
    hot: item.hot_id || 0
  }));

  return { items, source: "B站热榜" };
}

// Helper: fetch JSON with timeout
async function fetchJSON(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const result = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...options.headers
      }
    });

    const text = await result.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("返回的不是 JSON");
    }

    if (!result.ok) {
      throw new Error(`请求失败: ${result.status}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}
