const DEFAULT_TIMEOUT_MS = 50000;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const { content, style, action, prompt } = request.body || {};

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return response.status(501).json({
      error: "nvidia_not_configured",
      message: "请配置 NVIDIA_API_KEY 环境变量"
    });
  }

  // Action: generate single illustration from prompt
  if (action === "generate") {
    if (!prompt) {
      return response.status(400).json({ error: "missing_prompt" });
    }
    try {
      const url = await generateIllustration(apiKey, prompt);
      return response.status(200).json({ illustrationUrl: url });
    } catch (err) {
      console.error("Illustration generation failed:", err.message);
      return response.status(500).json({ error: "generation_failed", message: err.message });
    }
  }

  // Default action: analyze article + return shot list
  if (!content) {
    return response.status(400).json({ error: "missing_content", message: "请提供内容" });
  }

  try {
    const [summary, analysis] = await Promise.allSettled([
      generateSummary(apiKey, content),
      analyzeArticle(apiKey, content, style || "ian-xiaohei")
    ]);

    const summaryText = summary.status === "fulfilled" ? summary.value : "";
    const analysisResult = analysis.status === "fulfilled" ? analysis.value : null;

    if (!analysisResult || !analysisResult.shots || analysisResult.shots.length === 0) {
      return response.status(500).json({
        error: "generation_failed",
        message: "文章分析失败，请检查 NVIDIA API 配置"
      });
    }

    return response.status(200).json({
      summary: summaryText,
      articleStructure: analysisResult.structure || "",
      shots: analysisResult.shots.slice(0, 5),
      originalContent: content.slice(0, 200) + (content.length > 200 ? "..." : "")
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return response.status(500).json({
      error: "generation_failed",
      message: error.message
    });
  }
}

// Generate summary using LLM
async function generateSummary(apiKey, content) {
  const endpoint = process.env.NVIDIA_API_ENDPOINT || "https://integrate.api.nvidia.com/v1/chat/completions";
  const model = process.env.NVIDIA_MODEL || "minimaxai/minimax-m3";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是专业的内容编辑，擅长提炼摘要。" },
          { role: "user", content: `请为以下内容生成一段简洁的摘要（100字以内）：\n\n${content}` }
        ],
        temperature: 0.5,
        max_tokens: 200
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await result.json();
    if (!result.ok) {
      throw new Error(data.error?.message || "摘要生成失败");
    }
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return "";
    throw err;
  }
}

// Step 1: Extract cognitive anchors in Chinese
async function extractAnchors(apiKey, content) {
  const endpoint = process.env.NVIDIA_API_ENDPOINT || "https://integrate.api.nvidia.com/v1/chat/completions";
  const model = "meta/llama-3.1-8b-instruct";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是中文内容分析专家。只输出JSON，不要其他文字。" },
          { role: "user", content: `从以下文章中提取3个认知锚点（具体的判断、断点、对比或状态变化，不要泛泛关键词）。

文章：${content.slice(0, 1000)}

输出JSON：{"anchors":[{"name":"4-8字中文名称","meaning":"一句话含义","type":"contrast/pitfall/state/metaphor/workflow","scene":"小黑在做什么，必须是具体动作"}]}` }
        ],
        temperature: 0.5,
        max_tokens: 400
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await result.json();
    if (!result.ok) return null;

    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("Extract anchors error:", err.message);
  }
  return null;
}

// Step 2: Translate Chinese anchors to English prompts
async function translateToPrompt(apiKey, anchors) {
  const endpoint = process.env.NVIDIA_API_ENDPOINT || "https://integrate.api.nvidia.com/v1/chat/completions";
  const model = "meta/llama-3.1-8b-instruct";

  const anchorsJson = JSON.stringify(anchors);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an English translator for image generation prompts. Output pure English JSON only." },
          { role: "user", content: `Translate these Chinese illustration concepts to English image generation prompts.

Input: ${anchorsJson}

Output JSON with same structure, but translate all Chinese text to English. The "scene" field must be a detailed visual description in English showing what Xiaohei (a small black creature) is doing.

Output: {"anchors":[{"name":"English name","meaning":"English meaning","type":"same type","scene":"Detailed English visual scene description with Xiaohei doing a specific action"}]}` }
        ],
        temperature: 0.3,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await result.json();
    if (!result.ok) return null;

    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("Translate error:", err.message);
  }
  return null;
}

// Main analysis function
async function analyzeArticle(apiKey, content, style) {
  // Step 1: Extract anchors in Chinese
  const chineseAnchors = await extractAnchors(apiKey, content);
  if (!chineseAnchors || !chineseAnchors.anchors || chineseAnchors.anchors.length === 0) {
    return { structure: "单主题内容", shots: [buildFallbackShot(content)] };
  }

  // Step 2: Translate to English prompts
  const englishAnchors = await translateToPrompt(apiKey, chineseAnchors);
  if (!englishAnchors || !englishAnchors.anchors || englishAnchors.anchors.length === 0) {
    // Fallback: use Chinese anchors with manual translation
    return {
      structure: chineseAnchors.structure || "",
      shots: chineseAnchors.anchors.slice(0, 5).map(a => buildShotFromAnchor(a, content))
    };
  }

  // Build shots from English anchors
  return {
    structure: englishAnchors.structure || chineseAnchors.structure || "",
    shots: englishAnchors.anchors.slice(0, 5).map(a => buildShotFromEnglish(a))
  };
}

// Build shot from English anchor (after translation)
function buildShotFromEnglish(anchor) {
  const topic = anchor.name || "Core Concept";
  const meaning = anchor.meaning || "";
  const type = anchor.type || "metaphor";
  const scene = anchor.scene || "performing a conceptual action";

  return {
    topic,
    position: getPosition(type),
    meaning,
    structureType: type,
    xiaoheiAction: scene,
    annotations: [],
    prompt: buildIanXiaoheiPrompt(topic, meaning, type, scene)
  };
}

// Build shot from Chinese anchor (fallback)
function buildShotFromAnchor(anchor, content) {
  const topic = anchor.name || "核心判断";
  const meaning = anchor.meaning || content.slice(0, 60);
  const type = anchor.type || "metaphor";
  const scene = anchor.scene || "performing a conceptual action";

  return {
    topic,
    position: getPosition(type),
    meaning,
    structureType: type,
    xiaoheiAction: scene,
    annotations: [],
    prompt: buildIanXiaoheiPrompt(topic, meaning, type, scene)
  };
}

// Build fallback shot
function buildFallbackShot(content) {
  return {
    topic: "Core Judgment",
    position: "Core paragraph",
    meaning: content.slice(0, 60),
    structureType: "metaphor",
    xiaoheiAction: "standing before a giant absurd device, operating a core mechanism",
    annotations: [],
    prompt: buildIanXiaoheiPrompt("Core Judgment", content.slice(0, 60), "metaphor", "standing before a giant absurd device, operating a core mechanism")
  };
}

// Get position based on type
function getPosition(type) {
  const positions = {
    workflow: "After the process description",
    contrast: "At the strongest contrast point",
    metaphor: "At the core metaphor",
    state: "At the state change",
    system: "At the system description",
    pitfall: "At the warning section",
    handoff: "At the handoff point"
  };
  return positions[type] || "Core paragraph";
}

// Build Ian Xiaohei style prompt (pure English)
function buildIanXiaoheiPrompt(topic, meaning, type, scene) {
  const typeMap = {
    workflow: "Workflow",
    contrast: "Before-After Contrast",
    metaphor: "Conceptual Metaphor",
    state: "State Change",
    system: "System Partial View",
    pitfall: "Common Pitfall",
    handoff: "Handoff Path"
  };
  const structureType = typeMap[type] || "Conceptual Metaphor";

  return `Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character required:
A small solid-black absurd creature called Xiaohei with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. Xiaohei must perform the core conceptual action, not decorate the scene. Make Xiaohei serious, deadpan, and slightly bizarre, not cute.

Theme:
${topic}

Structure type:
${structureType}

Core idea:
${meaning}

Composition:
Xiaohei is ${scene}. The main subject occupies about 40-60% of the canvas with at least 35% blank white space preserved.

Chinese handwritten labels:
Short Chinese annotations in red, orange, or blue ink, 2-4 characters each, maximum 5 spots on the image.

Color use:
Black for main line art and Xiaohei. Orange for main flow or path arrows. Red only for key warnings or problems. Blue only for secondary notes or system state feedback.

Constraints:
One image explains only one core structure. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. It should be clear but not instructional, interesting but not childish, strange but clean.`;
}

// Generate illustration using NVIDIA FLUX.1-dev model (with retry)
async function generateIllustration(apiKey, prompt, retries = 2) {
  const endpoint = process.env.NVIDIA_FLUX_ENDPOINT || "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`FLUX retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          accept: "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          cfg_scale: 3.5,
          height: 1024,
          width: 1024,
          steps: 20,
          seed: Math.floor(Math.random() * 1000000) // Random seed for variety
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!result.ok) {
        const errorText = await result.text();
        console.error(`FLUX.1-dev error (attempt ${attempt + 1}):`, result.status, errorText.slice(0, 100));
        if (result.status === 429) {
          // Rate limited, wait longer before retry
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        if (attempt === retries) return null;
        continue;
      }

      const data = await result.json();

      if (data.artifacts?.[0]?.base64) {
        return `data:image/png;base64,${data.artifacts[0].base64}`;
      }
      if (data.images?.[0]) {
        const img = data.images[0];
        if (typeof img === "string") {
          return img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
        }
        if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
        if (img.url) return img.url;
      }

      console.log("Unrecognized FLUX response:", Object.keys(data));
      if (attempt === retries) return null;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === "AbortError") {
        console.error(`FLUX.1-dev timeout (attempt ${attempt + 1})`);
        if (attempt === retries) return null;
        continue;
      }
      console.error(`FLUX.1-dev failed (attempt ${attempt + 1}):`, error.message);
      if (attempt === retries) return null;
    }
  }

  return null;
}
