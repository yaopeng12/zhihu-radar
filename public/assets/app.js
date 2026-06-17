(function () {
  const form = document.querySelector("#radar-form");
  const keywordInput = document.querySelector("#keyword");
  const analyzeBtn = document.querySelector("#analyze-btn");
  const copyBtn = document.querySelector("#copy-btn");
  const toast = document.querySelector("#toast");
  const emptyState = document.querySelector("#empty-state");
  const resultsContainer = document.querySelector("#results-container");

  const modeBtns = document.querySelectorAll(".mode-btn");
  const viewRadar = document.querySelector("#view-radar");
  const viewHot = document.querySelector("#view-hot");

  const hotKeywordInput = document.querySelector("#hot-keyword");
  const hotFilterBtn = document.querySelector("#hot-filter-btn");

  let currentReport = null;
  let currentHotData = { items: [], total: 0, filtered: 0, keyword: null, source: "-", updatedAt: new Date().toISOString() };
  let currentMode = "hot";

  function switchMode(mode) {
    currentMode = mode;
    modeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
    viewRadar.classList.toggle("active", mode === "radar");
    viewHot.classList.toggle("active", mode === "hot");
    document.body.classList.toggle("mode-hot", mode === "hot");
    document.body.classList.toggle("mode-radar", mode === "radar");
    if (mode === "hot" && !currentHotData.items.length) {
      loadHotList();
    }
  }

  async function loadReport() {
    const keyword = keywordInput.value.trim();
    if (!keyword) { showToast("请输入关键词"); return; }

    emptyState.style.display = "none";
    resultsContainer.style.display = "block";
    hideAllSections();
    setLoading(true);

    try {
      const url = new URL("/api/search", window.location.href);
      url.searchParams.set("q", keyword);
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const payload = await res.json();

      if (!res.ok || payload.error) throw new Error(payload.message || payload.error || "搜索失败");

      currentReport = normalizeReport({ ...payload, keyword });

      // Render metrics and questions first
      renderMetricsAndQuestions(currentReport);

      // Then run AI and render summary/pains/ideas after it completes
      if (currentReport.questions.length) {
        await runAIAnalysis();
      } else {
        revealSection(".insight-layout", 0);
        revealSection("#ideas", 0);
      }

      showToast("分析完成");
    } catch (error) {
      currentReport = normalizeReport({ ...window.ZHIHU_RADAR_SAMPLE, keyword, source: "Demo" });
      renderMetricsAndQuestions(currentReport);
      revealSection(".insight-layout", 0);
      renderSummary(currentReport);
      renderPains(currentReport.pains);
      revealSection("#ideas", 0);
      renderIdeas(currentReport.ideas);
      showToast("API 未连通，使用演示数据");
    } finally {
      setLoading(false);
    }
  }

  async function runAIAnalysis() {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "AI 分析中...";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyword: currentReport.keyword,
          questions: currentReport.questions.slice(0, 10)
        })
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.message || "AI 分析失败");

      if (payload.summary) currentReport.summary = payload.summary;
      if (payload.pains?.length) currentReport.pains = payload.pains;
      if (payload.ideas?.length) currentReport.ideas = payload.ideas;
      currentReport.source = (currentReport.source || "") + " · AI";
      text("#source-badge", currentReport.source);
    } catch (e) {
      console.error(e);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "AI 分析";
    }

    // Render insight sections with AI results
    revealSection(".insight-layout", 0);
    renderSummary(currentReport);
    renderPains(currentReport.pains);

    revealSection("#ideas", 150);
    renderIdeas(currentReport.ideas);
  }

  async function loadHotList(filterKeyword) {
    const keyword = (filterKeyword || hotKeywordInput.value || "").trim();
    try {
      const url = new URL("/api/hot", window.location.href);
      if (keyword) url.searchParams.set("keyword", keyword);
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.message || "热榜获取失败");
      if (!payload.items?.length) throw new Error("热榜数据为空");
      currentHotData = { ...payload, source: payload.source || "Zhihu Hot List" };
      renderHotList(currentHotData);
      showToast("热榜已更新");
    } catch (error) {
      // Fallback to demo data
      currentHotData = { ...window.ZHIHU_RADAR_HOT_SAMPLE, keyword: keyword || null, source: "Demo" };
      if (keyword) {
        currentHotData.items = currentHotData.items.filter((i) => i.title.includes(keyword));
        currentHotData.filtered = currentHotData.items.length;
      }
      renderHotList(currentHotData);
    }
  }

  function normalizeReport(raw) {
    return {
      keyword: raw.keyword || keywordInput?.value || "",
      summary: raw.summary || "",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      pains: Array.isArray(raw.pains) ? raw.pains : [],
      questions: Array.isArray(raw.questions) ? raw.questions : [],
      ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
      source: raw.source || "-",
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function renderMetricsAndQuestions(report) {
    hideAllSections();

    // Metrics
    revealSection("#overview", 0);
    animateNumber("#metric-questions", report.questions.length);
    animateNumber("#metric-followers", sum(report.questions, "followers"));
    animateNumber("#metric-answers", sum(report.questions, "answers"));
    animateNumber("#metric-opportunities", report.questions.filter((q) => q.opportunity === "高").length);
    text("#page-title", `${report.keyword} 趋势洞察`);
    text("#source-badge", report.source);
    text("#updated-at", `更新于 ${formatDate(report.updatedAt)}`);
    renderTags(report.tags);

    // Questions
    revealSection("#questions", 150);
    renderQuestions(report.questions);

    // Ideas placeholder (will be filled by AI)
    revealSection("#ideas", 0);
  }

  function renderSummary(report) {
    const el = document.querySelector("#summary");
    el.textContent = report.summary || "暂无摘要";
  }

  function renderPains(pains) {
    const ul = document.querySelector("#pain-list");
    ul.replaceChildren();
    pains.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = p;
      li.style.opacity = "0";
      li.style.transform = "translateX(-10px)";
      ul.appendChild(li);
      setTimeout(() => {
        li.style.transition = "all 0.25s ease";
        li.style.opacity = "1";
        li.style.transform = "translateX(0)";
      }, i * 100);
    });
  }

  function renderQuestions(questions) {
    const tbody = document.querySelector("#question-table");
    tbody.replaceChildren();
    questions.forEach((q, i) => {
      const row = document.createElement("tr");
      const cls = q.opportunity === "高" ? "high" : q.opportunity === "中" ? "medium" : "low";
      row.innerHTML = `
        <td><a href="${escAttr(q.url)}" target="_blank" rel="noreferrer">${esc(q.title)}</a></td>
        <td>${fmt(q.followers || 0)}</td>
        <td>${fmt(q.answers || 0)}</td>
        <td><span class="opportunity ${cls}">${esc(q.opportunity || "-")}</span></td>
      `;
      row.style.opacity = "0";
      tbody.appendChild(row);
      setTimeout(() => { row.style.transition = "opacity 0.2s ease"; row.style.opacity = "1"; }, i * 60);
    });
  }

  function renderIdeas(ideas) {
    const grid = document.querySelector("#idea-grid");
    grid.replaceChildren();
    ideas.forEach((idea, i) => {
      const card = document.createElement("article");
      card.className = "idea-card";
      card.innerHTML = `
        <span>${esc(idea.platform || "内容平台")}</span>
        <h4>${esc(idea.title || "未命名选题")}</h4>
        <p>${esc(idea.angle || "")}</p>
      `;
      card.style.opacity = "0";
      grid.appendChild(card);
      setTimeout(() => { card.style.transition = "opacity 0.25s ease"; card.style.opacity = "1"; }, i * 100);
    });
  }

  function renderTags(tags) {
    const c = document.querySelector("#tag-cloud");
    c.replaceChildren();
    tags.forEach((t, i) => {
      const el = document.createElement("span");
      el.textContent = t;
      el.style.opacity = "0";
      c.appendChild(el);
      setTimeout(() => { el.style.transition = "opacity 0.2s ease"; el.style.opacity = "1"; }, i * 80);
    });
  }

  function renderHotList(data) {
    text("#hot-total", fmt(data.total));
    text("#hot-filtered", fmt(data.filtered));
    text("#hot-source", data.source);
    text("#hot-updated", formatDate(data.updatedAt));
    text("#hot-badge", data.source);

    const tbody = document.querySelector("#hot-table");
    tbody.replaceChildren();
    data.items.forEach((item, i) => {
      const row = document.createElement("tr");
      const rc = item.rank <= 3 ? "hot-rank top-3" : "hot-rank";
      row.innerHTML = `
        <td><span class="${rc}">${item.rank}</span></td>
        <td class="hot-title">
          <a href="${escAttr(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a>
          ${item.excerpt ? `<span class="hot-excerpt">${esc(item.excerpt)}</span>` : ""}
        </td>
      `;
      row.style.opacity = "0";
      tbody.appendChild(row);
      setTimeout(() => { row.style.transition = "opacity 0.15s ease"; row.style.opacity = "1"; }, i * 30);
    });
  }

  function animateNumber(sel, target) {
    const el = document.querySelector(sel);
    const dur = 600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * ease));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function revealSection(sel, delay) {
    setTimeout(() => { const el = document.querySelector(sel); if (el) el.classList.add("visible"); }, delay);
  }

  function hideAllSections() {
    document.querySelectorAll(".reveal-section").forEach((el) => el.classList.remove("visible"));
  }

  function text(sel, v) { const el = document.querySelector(sel); if (el) el.textContent = v; }
  function sum(a, k) { return a.reduce((t, i) => t + Number(i[k] || 0), 0); }
  function fmt(n) { return new Intl.NumberFormat("zh-CN", { notation: n > 9999 ? "compact" : "standard" }).format(n); }
  function formatDate(v) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v)); }
  function formatHeat(v) {
    if (v >= 10000000) return `${(v / 10000000).toFixed(1)}<span class="hot-heat-unit">千万</span>`;
    if (v >= 10000) return `${(v / 10000).toFixed(1)}<span class="hot-heat-unit">万</span>`;
    return fmt(v);
  }
  function showToast(m) { toast.textContent = m; toast.classList.add("is-visible"); setTimeout(() => toast.classList.remove("is-visible"), 2200); }
  function setLoading(l) { analyzeBtn.disabled = l; }
  function esc(s) { return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
  function escAttr(s) { const u = String(s || "#"); return esc(u.startsWith("http") ? u : "#"); }

  form.addEventListener("submit", (e) => { e.preventDefault(); loadReport(); });
  analyzeBtn.addEventListener("click", runAIAnalysis);
  copyBtn.addEventListener("click", async () => {
    if (!currentReport) { showToast("请先分析关键词"); return; }
    await navigator.clipboard.writeText(toMarkdown(currentReport));
    showToast("Markdown 已复制");
  });
  modeBtns.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));
  hotFilterBtn.addEventListener("click", () => loadHotList());
  hotKeywordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); loadHotList(); } });

  function toMarkdown(r) {
    const q = r.questions.map((i, n) => `${n + 1}. [${i.title}](${i.url}) - 关注 ${i.followers || 0} / 回答 ${i.answers || 0} / 机会 ${i.opportunity || "-"}`).join("\n");
    const ideas = r.ideas.map((i, n) => `${n + 1}. ${i.platform}：${i.title}\n   ${i.angle}`).join("\n");
    const hot = currentHotData.items.map((i) => `${i.rank}. [${i.title}](${i.url}) - 热度 ${i.heat}`).join("\n");
    return `# ${r.keyword} 趋势洞察\n\n## 实时热榜\n${hot || "暂无"}\n\n## 摘要\n${r.summary}\n\n## 标签\n${r.tags.join("、")}\n\n## 用户痛点\n${r.pains.map((p) => `- ${p}`).join("\n")}\n\n## 问题池\n${q}\n\n## 选题建议\n${ideas}\n`;
  }

  // Init: set body class and load hot list
  document.body.classList.add("mode-hot");
  loadHotList();
})();
