const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "minimaxai/minimax-m3";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const apiKey = request.headers["x-nvidia-api-key"] || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return response.status(501).json({
      error: "nvidia_api_not_configured",
      message: "请配置 NVIDIA_API_KEY 环境变量，或在请求头中传入 x-nvidia-api-key。"
    });
  }

  const { keyword, questions } = request.body || {};
  if (!keyword || !Array.isArray(questions) || questions.length === 0) {
    return response.status(400).json({
      error: "missing_data",
      message: "请提供 keyword 和 questions 字段。"
    });
  }

  const endpoint = process.env.NVIDIA_API_ENDPOINT || DEFAULT_NVIDIA_ENDPOINT;
  const model = process.env.NVIDIA_MODEL || DEFAULT_MODEL;

  try {
    const analysis = await callLLM({ apiKey, endpoint, model, keyword, questions });
    return response.status(200).json(analysis);
  } catch (error) {
    return response.status(error.statusCode || 502).json({
      error: "llm_failed",
      message: error.message
    });
  }
}

async function callLLM({ apiKey, endpoint, model, keyword, questions }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const questionList = questions
    .map((q, i) => `${i + 1}. ${q.title}（关注 ${q.followers}，回答 ${q.answers}）`)
    .join("\n");

  const prompt = `你是知乎内容分析专家。根据以下关键词「${keyword}」的搜索结果，生成一份内容分析报告。

搜索结果：
${questionList}

请严格按以下 JSON 格式返回，不要包含任何其他文字：

{
  "summary": "2-3句话的趋势摘要，引用具体问题标题，分析用户关注焦点和趋势走向",
  "pains": ["痛点1：具体描述", "痛点2：具体描述", "痛点3：具体描述", "痛点4：具体描述"],
  "ideas": [
    {"platform": "公众号", "title": "具体标题", "angle": "切入角度"},
    {"platform": "小红书", "title": "具体标题", "angle": "切入角度"},
    {"platform": "B站", "title": "具体标题", "angle": "切入角度"},
    {"platform": "播客", "title": "具体标题", "angle": "切入角度"}
  ]
}`;

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是专业的内容分析师，只输出 JSON，不要输出其他内容。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const text = await result.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("NVIDIA API 返回了无法解析的 JSON。");
    }

    if (!result.ok) {
      const message = body.error?.message || body.message || `NVIDIA API 返回 ${result.status}`;
      const error = new Error(message);
      error.statusCode = result.status;
      throw error;
    }

    const content = body.choices?.[0]?.message?.content || "";
    return parseLLMResponse(content);
  } finally {
    clearTimeout(timer);
  }
}

function parseLLMResponse(content) {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM 返回内容中未找到有效的 JSON。");
  }

  try {
    const data = JSON.parse(jsonMatch[0]);
    return {
      summary: String(data.summary || "").trim(),
      pains: Array.isArray(data.pains) ? data.pains.map(String) : [],
      ideas: Array.isArray(data.ideas)
        ? data.ideas.map((item) => ({
            platform: String(item.platform || ""),
            title: String(item.title || ""),
            angle: String(item.angle || "")
          }))
        : []
    };
  } catch {
    throw new Error("LLM 返回的 JSON 格式不正确。");
  }
}
