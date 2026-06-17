(function () {
  const form = document.querySelector("#radar-form");
  const keywordInput = document.querySelector("#keyword");
  const endpointInput = document.querySelector("#api-endpoint");
  const apiKeyInput = document.querySelector("#api-key");
  const refreshBtn = document.querySelector("#refresh-btn");
  const copyBtn = document.querySelector("#copy-btn");
  const toast = document.querySelector("#toast");

  let currentReport = normalizeReport(window.ZHIHU_RADAR_SAMPLE);
  const savedApiKey = window.localStorage.getItem("zhihu-radar-api-key");
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  function normalizeReport(raw) {
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    return {
      keyword: raw.keyword || keywordInput?.value || "知乎趋势",
      summary: raw.summary || "暂未生成摘要。",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      pains: Array.isArray(raw.pains) ? raw.pains : [],
      questions,
      ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
      source: raw.source || "Demo",
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  async function loadReport() {
    const keyword = keywordInput.value.trim() || "AI Agent";
    const endpoint = endpointInput.value.trim() || "/api/search";
    const apiKey = apiKeyInput.value.trim();
    window.localStorage.setItem("zhihu-radar-api-key", apiKey);
    setLoading(true);

    try {
      const url = new URL(endpoint, window.location.href);
      url.searchParams.set("q", keyword);
      const response = await fetch(url.toString(), {
        headers: {
          accept: "application/json",
          ...(apiKey ? { "x-zhihu-api-key": apiKey } : {})
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error) {
        throw new Error(payload.message || payload.error || `API returned ${response.status}`);
      }
      currentReport = normalizeReport({
        ...payload,
        keyword,
        source: payload.source || "Zhihu API"
      });
      render(currentReport);
      showToast("分析已更新");
    } catch (error) {
      console.error(error);
      currentReport = normalizeReport({
        ...window.ZHIHU_RADAR_SAMPLE,
        keyword,
        source: "Demo"
      });
      render(currentReport);
      showToast(`真实 API 未连通：${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function render(report) {
    const totalFollowers = sum(report.questions, "followers");
    const totalAnswers = sum(report.questions, "answers");
    const opportunities = report.questions.filter((item) => item.opportunity === "高").length;

    text("#page-title", `${report.keyword} 趋势洞察`);
    text("#metric-questions", formatNumber(report.questions.length));
    text("#metric-followers", formatNumber(totalFollowers));
    text("#metric-answers", formatNumber(totalAnswers));
    text("#metric-opportunities", formatNumber(opportunities));
    text("#summary", report.summary);
    text("#source-badge", report.source);
    text("#updated-at", `更新于 ${formatDate(report.updatedAt)}`);

    renderTags(report.tags);
    renderList("#pain-list", report.pains);
    renderQuestions(report.questions);
    renderIdeas(report.ideas);
  }

  function renderTags(tags) {
    const container = document.querySelector("#tag-cloud");
    container.replaceChildren(
      ...tags.map((tag) => {
        const element = document.createElement("span");
        element.textContent = tag;
        return element;
      })
    );
  }

  function renderList(selector, items) {
    const container = document.querySelector(selector);
    container.replaceChildren(
      ...items.map((item) => {
        const element = document.createElement("li");
        element.textContent = item;
        return element;
      })
    );
  }

  function renderQuestions(questions) {
    const tbody = document.querySelector("#question-table");
    tbody.replaceChildren(
      ...questions.map((question) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><a href="${escapeAttribute(question.url)}" target="_blank" rel="noreferrer">${escapeHtml(question.title)}</a></td>
          <td>${formatNumber(question.followers || 0)}</td>
          <td>${formatNumber(question.answers || 0)}</td>
          <td><span class="opportunity">${escapeHtml(question.opportunity || "待评估")}</span></td>
        `;
        return row;
      })
    );
  }

  function renderIdeas(ideas) {
    const grid = document.querySelector("#idea-grid");
    grid.replaceChildren(
      ...ideas.map((idea) => {
        const card = document.createElement("article");
        card.className = "idea-card";
        card.innerHTML = `
          <span>${escapeHtml(idea.platform || "内容平台")}</span>
          <h4>${escapeHtml(idea.title || "未命名选题")}</h4>
          <p>${escapeHtml(idea.angle || "补充分析角度。")}</p>
        `;
        return card;
      })
    );
  }

  function toMarkdown(report) {
    const questions = report.questions
      .map(
        (item, index) =>
          `${index + 1}. [${item.title}](${item.url}) - 关注 ${item.followers || 0} / 回答 ${item.answers || 0} / 机会 ${item.opportunity || "待评估"}`
      )
      .join("\n");
    const ideas = report.ideas
      .map((item, index) => `${index + 1}. ${item.platform}：${item.title}\n   ${item.angle}`)
      .join("\n");

    return `# ${report.keyword} 趋势洞察\n\n## 摘要\n${report.summary}\n\n## 标签\n${report.tags.join("、")}\n\n## 用户痛点\n${report.pains.map((item) => `- ${item}`).join("\n")}\n\n## 问题池\n${questions}\n\n## 选题建议\n${ideas}\n`;
  }

  function setLoading(isLoading) {
    form.classList.toggle("is-loading", isLoading);
    refreshBtn.disabled = isLoading;
  }

  function text(selector, value) {
    document.querySelector(selector).textContent = value;
  }

  function sum(items, key) {
    return items.reduce((total, item) => total + Number(item[key] || 0), 0);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN", { notation: value > 9999 ? "compact" : "standard" }).format(value);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    const url = String(value || "#");
    return escapeHtml(url.startsWith("http") ? url : "#");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadReport();
  });

  refreshBtn.addEventListener("click", loadReport);

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(toMarkdown(currentReport));
    showToast("Markdown 报告已复制");
  });

  render(currentReport);
})();
