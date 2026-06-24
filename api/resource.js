import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "minimaxai/minimax-m3";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const { topic, platformId } = request.body || {};
  if (!topic) {
    return response.status(400).json({ error: "missing_topic", message: "请提供 topic" });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return response.status(501).json({
      error: "nvidia_not_configured",
      message: "请配置 NVIDIA_API_KEY 环境变量"
    });
  }

  try {
    // Generate resource content using AI
    const content = await generateResourceContent(apiKey, topic);

    // Load platform config
    const promotionsFile = join(process.cwd(), "data", "promotions.json");
    let platform = null;
    if (existsSync(promotionsFile)) {
      const promotions = JSON.parse(readFileSync(promotionsFile, "utf8"));
      platform = promotions.platforms.find((p) => p.id === platformId) ||
                 promotions.platforms.find((p) => p.id === promotions.defaultPlatform);
    }

    return response.status(200).json({
      topic,
      content,
      platform: platform ? {
        id: platform.id,
        name: platform.name,
        url: platform.url,
        description: platform.description
      } : null
    });
  } catch (error) {
    return response.status(500).json({
      error: "generation_failed",
      message: error.message
    });
  }
}

async function generateResourceContent(apiKey, topic) {
  const endpoint = process.env.NVIDIA_API_ENDPOINT || DEFAULT_NVIDIA_ENDPOINT;
  const model = process.env.NVIDIA_MODEL || DEFAULT_MODEL;

  const prompt = `你是资源整理专家。根据话题「${topic}」，生成一份资源推荐文案。

要求：
1. 标题吸引人，包含关键词
2. 列出5-8个相关资源/工具/资料
3. 每个资源简要说明用途
4. 最后引导用户保存到网盘
5. 语气亲切自然，不要太营销

请直接输出文案内容，不要包含其他说明。`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
          { role: "system", content: "你是专业的内容创作助手，擅长写资源推荐文案。" },
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
      throw new Error("AI 返回无法解析的 JSON");
    }

    if (!result.ok) {
      throw new Error(body.error?.message || `AI 返回 ${result.status}`);
    }

    return body.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}
