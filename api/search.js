const DEFAULT_TIMEOUT_MS = 12000;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const keyword = String(request.query.q || "").trim();
  if (!keyword) {
    return response.status(400).json({
      error: "missing_keyword",
      message: "请提供 q 查询参数。"
    });
  }

  const apiKey = request.headers["x-zhihu-api-key"] || process.env.ZHIHU_API_KEY;
  const searchUrl = process.env.ZHIHU_SEARCH_URL;

  if (!searchUrl) {
    return response.status(501).json({
      error: "zhihu_api_not_configured",
      message:
        "服务端还没有配置 ZHIHU_SEARCH_URL。请在 Vercel 环境变量中设置知乎搜索 API 地址。"
    });
  }

  try {
    const upstream = await callZhihuSearch({ apiKey, keyword, searchUrl });
    const report = buildReport(keyword, upstream);
    return response.status(200).json(report);
  } catch (error) {
    return response.status(error.statusCode || 502).json({
      error: "zhihu_api_failed",
      message: error.message
    });
  }
}

async function callZhihuSearch({ apiKey, keyword, searchUrl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = new URL(searchUrl);
    url.searchParams.set("q", keyword);
    const result = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      }
    });

    const text = await result.text();
    const body = text ? JSON.parse(text) : {};
    if (!result.ok) {
      const message = body.message || body.error || `知乎 API 返回 ${result.status}`;
      const error = new Error(message);
      error.statusCode = result.status;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function buildReport(keyword, upstream) {
  const questions = extractItems(upstream).map((item) => normalizeItem(item, keyword));
  const tags = extractTags(keyword, questions);
  const highOpportunityCount = questions.filter((item) => item.opportunity === "高").length;

  return {
    keyword,
    source: "Zhihu API",
    updatedAt: new Date().toISOString(),
    summary: summarize(keyword, questions),
    tags,
    pains: buildPains(keyword, questions),
    questions,
    ideas: buildIdeas(keyword, questions, highOpportunityCount),
    rawCount: questions.length
  };
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    payload.list,
    payload.data?.items,
    payload.data?.results,
    payload.data?.list
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeItem(item, keyword) {
  const title =
    item.title ||
    item.question?.title ||
    item.name ||
    item.text ||
    item.content?.title ||
    `${keyword} 相关内容`;
  const url = item.url || item.link || item.question?.url || item.content?.url || "https://www.zhihu.com/search";
  const followers = Number(item.followers || item.follower_count || item.follow_count || item.score || 0);
  const answers = Number(item.answers || item.answer_count || item.comment_count || item.reply_count || 0);

  return {
    title: stripHtml(title),
    url,
    followers,
    answers,
    opportunity: scoreOpportunity(followers, answers),
    excerpt: stripHtml(item.excerpt || item.summary || item.description || item.content || "")
  };
}

function scoreOpportunity(followers, answers) {
  if (followers >= 1000 && answers <= 80) return "高";
  if (followers >= 300 || answers <= 30) return "中";
  return "低";
}

function summarize(keyword, questions) {
  if (!questions.length) {
    return `暂未从知乎 API 获取到与「${keyword}」相关的结构化结果。可以检查关键词、API 额度或搜索接口配置。`;
  }
  const hot = questions.slice(0, 3).map((item) => `「${item.title}」`).join("、");
  return `知乎 API 返回了 ${questions.length} 条与「${keyword}」相关的结果。当前最值得关注的问题包括 ${hot}。建议优先观察高关注但回答数相对不足的问题，这类内容通常更适合继续追踪、整理和创作。`;
}

function buildPains(keyword, questions) {
  if (!questions.length) {
    return ["搜索接口已连通，但没有结果可分析。", "建议换一个更具体的关键词，或检查知乎 API 的搜索类型。"];
  }
  return [
    `用户正在围绕「${keyword}」寻找更具体、可执行的经验。`,
    "高关注问题往往需要结构化整理，而不是简单搬运回答。",
    "回答数较少但关注度较高的问题，可能存在明显内容缺口。",
    "不同结果之间的共性问题适合沉淀成长期追踪报告。"
  ];
}

function buildIdeas(keyword, questions, highOpportunityCount) {
  const firstQuestion = questions[0]?.title || `${keyword} 的真实问题`;
  return [
    {
      platform: "公众号",
      title: `从知乎 ${questions.length || 0} 条结果看：${keyword} 真正被关心什么`,
      angle: "用问题聚类和高频痛点做深度整理。"
    },
    {
      platform: "小红书",
      title: `${keyword} 新手最容易踩的几个坑`,
      angle: "把知乎问题转译成更轻量的经验清单。"
    },
    {
      platform: "B 站",
      title: `我分析了知乎上关于 ${keyword} 的高关注问题`,
      angle: `围绕「${firstQuestion}」展开案例拆解。`
    },
    {
      platform: "播客",
      title: `${keyword} 是趋势，还是短期热闹？`,
      angle: `结合 ${highOpportunityCount} 个高机会问题聊长期判断。`
    }
  ];
}

function extractTags(keyword, questions) {
  const base = [keyword, "知乎搜索", "趋势洞察", "内容机会"];
  const extra = questions
    .flatMap((item) => item.title.split(/[，。！？、\s]+/))
    .filter((word) => word.length >= 2 && word.length <= 8)
    .slice(0, 3);
  return Array.from(new Set([...base, ...extra])).slice(0, 8);
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}
