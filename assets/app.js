(function () {
  const form = document.querySelector("#radar-form");
  const keywordInput = document.querySelector("#keyword");
  const endpointInput = document.querySelector("#api-endpoint");
  const refreshBtn = document.querySelector("#refresh-btn");
  const copyBtn = document.querySelector("#copy-btn");
  const toast = document.querySelector("#toast");

  let currentReport = normalizeReport(window.ZHIHU_RADAR_SAMPLE);

  function normalizeReport(raw) {
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    return {
      keyword: raw.keyword || keywordInput?.value || "鐭ヤ箮瓒嬪娍",
      summary: raw.summary || "鏆傛湭鐢熸垚鎽樿銆?,
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
    const endpoint = endpointInput.value.trim();
    setLoading(true);

    try {
      if (!endpoint) {
        currentReport = normalizeReport({
          ...window.ZHIHU_RADAR_SAMPLE,
          keyword,
          source: "Demo"
        });
      } else {
        const url = new URL(endpoint);
        url.searchParams.set("q", keyword);
        const response = await fetch(url.toString(), {
          headers: { accept: "application/json" }
        });
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        currentReport = normalizeReport({
          ...(await response.json()),
          keyword,
          source: "API"
        });
      }
      render(currentReport);
      showToast("鍒嗘瀽宸叉洿鏂?);
    } catch (error) {
      console.error(error);
      showToast("API 璇锋眰澶辫触锛屽凡淇濈暀褰撳墠鎶ュ憡");
    } finally {
      setLoading(false);
    }
  }

  function render(report) {
    const totalFollowers = sum(report.questions, "followers");
    const totalAnswers = sum(report.questions, "answers");
    const opportunities = report.questions.filter((item) => item.opportunity === "楂?).length;

    text("#page-title", `${report.keyword} 瓒嬪娍娲炲療`);
    text("#metric-questions", formatNumber(report.questions.length));
    text("#metric-followers", formatNumber(totalFollowers));
    text("#metric-answers", formatNumber(totalAnswers));
    text("#metric-opportunities", formatNumber(opportunities));
    text("#summary", report.summary);
    text("#source-badge", report.source);
    text("#updated-at", `鏇存柊浜?${formatDate(report.updatedAt)}`);

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
          <td><span class="opportunity">${escapeHtml(question.opportunity || "寰呰瘎浼?)}</span></td>
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
          <span>${escapeHtml(idea.platform || "鍐呭骞冲彴")}</span>
          <h4>${escapeHtml(idea.title || "鏈懡鍚嶉€夐")}</h4>
          <p>${escapeHtml(idea.angle || "琛ュ厖鍒嗘瀽瑙掑害銆?)}</p>
        `;
        return card;
      })
    );
  }

  function toMarkdown(report) {
    const questions = report.questions
      .map(
        (item, index) =>
          `${index + 1}. [${item.title}](${item.url}) - 鍏虫敞 ${item.followers || 0} / 鍥炵瓟 ${item.answers || 0} / 鏈轰細 ${item.opportunity || "寰呰瘎浼?}`
      )
      .join("\n");
    const ideas = report.ideas
      .map((item, index) => `${index + 1}. ${item.platform}锛?{item.title}\n   ${item.angle}`)
      .join("\n");

    return `# ${report.keyword} 瓒嬪娍娲炲療\n\n## 鎽樿\n${report.summary}\n\n## 鏍囩\n${report.tags.join("銆?)}\n\n## 鐢ㄦ埛鐥涚偣\n${report.pains.map((item) => `- ${item}`).join("\n")}\n\n## 闂姹燶n${questions}\n\n## 閫夐寤鸿\n${ideas}\n`;
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
    showToast("Markdown 鎶ュ憡宸插鍒?);
  });

  render(currentReport);
})();
