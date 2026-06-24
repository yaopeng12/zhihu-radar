(function () {
  // DOM refs
  const navLinks = document.querySelectorAll(".nav-link");
  const toast = document.getElementById("toast");

  // Hot list
  const hotKeywordInput = document.getElementById("hot-keyword");
  const hotList = document.getElementById("hot-list");
  const platformTabs = document.querySelectorAll(".platform-tab");
  let currentPlatform = "zhihu";

  // Platform switching
  platformTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      currentPlatform = tab.dataset.platform;
      platformTabs.forEach(t => t.classList.toggle("active", t === tab));
      document.getElementById("hot-title").textContent = `🔥 ${tab.textContent}热榜`;
      loadHotList();
    });
  });

  // Radar
  const radarForm = document.getElementById("radar-form");
  const keywordInput = document.getElementById("keyword");
  const radarEmpty = document.getElementById("radar-empty");
  const radarResults = document.getElementById("radar-results");
  const copyBtn = document.getElementById("copy-btn");

  // Resources
  const resourceSearch = document.getElementById("resource-search");
  const resourceList = document.getElementById("resource-list");

  // State
  let currentReport = null;
  let currentHotData = { items: [], total: 0 };
  let allResources = [];

  // Navigation
  window.switchView = function(view) {
    navLinks.forEach(link => link.classList.toggle("active", link.dataset.view === view));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));

    if (view === "hot" && !currentHotData.items.length) loadHotList();
    if (view === "resources") loadResourceList();
  };

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchView(link.dataset.view);
    });
  });

  // Hot List
  async function loadHotList() {
    try {
      const keyword = hotKeywordInput.value.trim();
      const url = new URL("/api/hot", window.location.href);
      url.searchParams.set("platform", currentPlatform);
      if (keyword) url.searchParams.set("keyword", keyword);

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || "加载失败");

      currentHotData = data;
      renderHotList(data);
    } catch (error) {
      currentHotData = { ...window.ZHIHU_RADAR_HOT_SAMPLE, source: "Demo" };
      renderHotList(currentHotData);
    }
  }

  async function renderHotList(data) {
    document.getElementById("hot-count").textContent = data.items?.length || 0;
    document.getElementById("stat-total").textContent = data.total || 0;
    document.getElementById("stat-source").textContent = data.source || "-";
    document.getElementById("stat-updated").textContent = data.updatedAt ? formatDate(data.updatedAt) : "-";

    hotList.innerHTML = "";

    // Get all resource matches
    let allMatches = {};
    try {
      const res = await fetch("/api/promotions?action=resources");
      const resData = await res.json();
      // Build keyword -> resource map
      (resData.resources || []).forEach(r => {
        allMatches[r.id] = r;
      });
    } catch (e) {}

    (data.items || []).forEach((item, i) => {
      const rankClass = i < 3 ? `top-${i + 1}` : "";
      const div = document.createElement("div");
      div.className = "hot-item";

      // Check if topic matches any resource keywords
      let matchedResource = null;
      Object.values(allMatches).forEach(r => {
        if (!matchedResource && r.keywords?.some(k => item.title.includes(k))) {
          matchedResource = r;
        }
      });

      const actionHtml = matchedResource
        ? `<a class="btn btn-xs btn-success" href="/resource/${matchedResource.id}" target="_blank">查看资源</a>`
        : "";

      div.innerHTML = `
        <span class="hot-rank ${rankClass}">${item.rank}</span>
        <div class="hot-content">
          <div class="hot-title" onclick="window.open('${escAttr(item.url)}', '_blank')">${esc(item.title)}</div>
          ${item.excerpt ? `<div class="hot-excerpt">${esc(item.excerpt)}</div>` : ""}
        </div>
        <div class="hot-action">${actionHtml}</div>
      `;
      hotList.appendChild(div);
    });
  }

  // Radar Analysis
  radarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const keyword = keywordInput.value.trim();
    if (!keyword) { showToast("请输入关键词"); return; }

    radarEmpty.style.display = "none";
    radarResults.style.display = "block";

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message);

      currentReport = { ...data, keyword };
      renderRadarResults(currentReport);

      // Auto AI analysis
      runAIAnalysis();
    } catch (error) {
      currentReport = { ...window.ZHIHU_RADAR_SAMPLE, keyword };
      renderRadarResults(currentReport);
      showToast("API 未连通，使用演示数据");
    }
  });

  function renderRadarResults(report) {
    // Metrics
    animateValue("m-questions", report.questions?.length || 0);
    animateValue("m-followers", sum(report.questions, "followers"));
    animateValue("m-answers", sum(report.questions, "answers"));
    animateValue("m-opportunities", report.questions?.filter(q => q.opportunity === "高").length || 0);

    // Summary
    document.getElementById("summary").textContent = report.summary || "暂无摘要";
    document.getElementById("source-badge").textContent = report.source || "-";

    // Tags
    const tagCloud = document.getElementById("tag-cloud");
    tagCloud.innerHTML = (report.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");

    // Pains
    const painList = document.getElementById("pain-list");
    painList.innerHTML = (report.pains || []).map(p => `<li class="pain-item">${esc(p)}</li>`).join("");

    // Ideas
    const ideasGrid = document.getElementById("ideas-grid");
    ideasGrid.innerHTML = (report.ideas || []).map(idea => `
      <div class="idea-card">
        <span class="idea-platform">${esc(idea.platform)}</span>
        <div class="idea-title">${esc(idea.title)}</div>
        <div class="idea-angle">${esc(idea.angle)}</div>
      </div>
    `).join("");

    // Questions table
    const tbody = document.getElementById("question-table");
    tbody.innerHTML = (report.questions || []).map(q => `
      <tr>
        <td><a href="${escAttr(q.url)}" target="_blank">${esc(q.title)}</a></td>
        <td>${fmt(q.followers || 0)}</td>
        <td>${fmt(q.answers || 0)}</td>
        <td><span class="opportunity ${q.opportunity === "高" ? "high" : q.opportunity === "中" ? "medium" : "low"}">${esc(q.opportunity || "-")}</span></td>
      </tr>
    `).join("");
  }

  async function runAIAnalysis() {
    if (!currentReport?.questions?.length) return;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: currentReport.keyword, questions: currentReport.questions.slice(0, 10) })
      });
      const data = await res.json();
      if (!res.ok) return;

      if (data.summary) {
        currentReport.summary = data.summary;
        document.getElementById("summary").textContent = data.summary;
      }
      if (data.pains?.length) {
        currentReport.pains = data.pains;
        document.getElementById("pain-list").innerHTML = data.pains.map(p => `<li class="pain-item">${esc(p)}</li>`).join("");
      }
      if (data.ideas?.length) {
        currentReport.ideas = data.ideas;
        document.getElementById("ideas-grid").innerHTML = data.ideas.map(idea => `
          <div class="idea-card">
            <span class="idea-platform">${esc(idea.platform)}</span>
            <div class="idea-title">${esc(idea.title)}</div>
            <div class="idea-angle">${esc(idea.angle)}</div>
          </div>
        `).join("");
      }
      document.getElementById("source-badge").textContent = (currentReport.source || "") + " · AI";
    } catch (e) {
      // silent fail
    }
  }

  // Copy report
  copyBtn.addEventListener("click", async () => {
    if (!currentReport) return;
    const md = toMarkdown(currentReport);
    await navigator.clipboard.writeText(md);
    showToast("报告已复制");
  });

  // Resources
  async function loadResourceList() {
    try {
      const res = await fetch("/api/promotions?action=resources");
      const data = await res.json();
      allResources = data.pages || [];
      renderResourceList(allResources);
      document.getElementById("resource-total").textContent = allResources.length;
    } catch (e) {
      allResources = [];
    }
  }

  function renderResourceList(pages) {
    if (!pages.length) {
      resourceList.innerHTML = '<p class="empty-text">暂无资源页，去热榜页面生成</p>';
      return;
    }

    resourceList.innerHTML = pages.map(page => `
      <div class="resource-item">
        <div class="resource-info">
          <h4>${esc(page.topic)}</h4>
          <p>${esc(page.description)} · 👁 ${page.views || 0} 次浏览</p>
        </div>
        <div class="resource-actions">
          <a class="btn btn-sm" href="/resource/${page.id}" target="_blank">查看</a>
          <button class="btn btn-sm" onclick="deleteResource('${page.id}')">删除</button>
        </div>
      </div>
    `).join("");
  }

  window.deleteResource = async function(id) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/promotions?id=${id}`, { method: "DELETE" });
    loadResourceList();
    loadResourceStats();
  };

  resourceSearch.addEventListener("input", () => {
    const q = resourceSearch.value.trim().toLowerCase();
    if (!q) {
      renderResourceList(allResources);
      return;
    }
    const filtered = allResources.filter(r => r.topic.toLowerCase().includes(q));
    renderResourceList(filtered);
  });

  // Resource stats for sidebar
  async function loadResourceStats() {
    try {
      const res = await fetch("/api/promotions?action=resources");
      const data = await res.json();
      const pages = data.pages || [];

      document.getElementById("stat-resources").textContent = pages.length;

      const recent = document.getElementById("recent-resources");
      if (!pages.length) {
        recent.innerHTML = '<p class="empty-text">暂无资源页</p>';
        return;
      }

      recent.innerHTML = pages.slice(0, 5).map(page => `
        <a class="recent-item" href="/resource/${page.id}" target="_blank">
          <span class="recent-item-title">${esc(page.topic)}</span>
          <span class="recent-item-meta">👁 ${page.views || 0}</span>
        </a>
      `).join("");
    } catch (e) {
      // silent
    }
  }

  // Hot filter
  hotKeywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadHotList();
    }
  });

  // Illustration Module
  const contentInput = document.getElementById("content-input");
  const generateBtn = document.getElementById("generate-btn");
  const illustrationStyle = document.getElementById("illustration-style");
  const charCount = document.getElementById("char-count");
  const resultCard = document.getElementById("result-card");
  const emptyResult = document.getElementById("empty-result");
  const illustrationLoading = document.getElementById("illustration-loading");
  const illustrationImg = document.getElementById("illustration-img");

  // Templates
  const templates = {
    ai: "AI Agent 正在改变我们的工作方式。从自动化任务到智能决策，AI Agent 已经渗透到各个领域。无论是智能客服、代码助手还是数据分析，AI Agent 都展现出巨大的潜力。",
    education: "在线教育正在经历革命性的变化。AI 个性化学习、互动式课程、智能评估系统等新技术，让学习变得更加高效和有趣。",
    lifestyle: "极简生活方式正在年轻人中流行。断舍离、数字极简、慢生活等理念，帮助人们在快节奏的都市生活中找到平衡。",
    business: "新消费品牌正在重塑市场格局。通过社交媒体营销、DTC 模式和数据驱动运营，这些品牌快速崛起并赢得年轻消费者。"
  };

  document.querySelectorAll(".template-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const template = templates[btn.dataset.template];
      if (template) {
        contentInput.value = template;
        updateCharCount();
      }
    });
  });

  contentInput.addEventListener("input", updateCharCount);

  function updateCharCount() {
    charCount.textContent = `${contentInput.value.length} 字`;
  }

  generateBtn.addEventListener("click", generateIllustration);

  async function generateIllustration() {
    const content = contentInput.value.trim();
    if (!content) {
      showToast("请输入内容");
      return;
    }

    // Show loading
    resultCard.style.display = "block";
    emptyResult.style.display = "none";
    illustrationLoading.style.display = "flex";
    illustrationLoading.innerHTML = '<div class="spinner-lg"></div><p>AI 正在分析文章...</p>';
    document.getElementById("shots-container").innerHTML = "";
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> 分析中...';

    try {
      // Step 1: Analyze article
      const res = await fetch("/api/illustration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, style: illustrationStyle.value })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `请求失败 (${res.status})`);
      }

      const shots = data.shots || [];
      if (shots.length === 0) {
        illustrationLoading.innerHTML = '<p style="color: var(--muted); padding: 40px;">未能分析出配图方案</p>';
        return;
      }

      // Render article with illustration placeholders
      illustrationLoading.style.display = "none";
      generateBtn.innerHTML = '<span class="spinner"></span> 生成配图中...';

      const container = document.getElementById("shots-container");
      container.innerHTML = renderArticle(content, data.summary, shots);

      // Step 2: Generate illustrations in parallel
      const imageSlots = container.querySelectorAll(".article-illustration[data-slot]");
      const generatePromises = shots.map(async (shot, i) => {
        const slot = imageSlots[i];
        if (!slot) return false;

        try {
          const res = await fetch("/api/illustration", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "generate", prompt: shot.prompt })
          });

          const result = await res.json();
          if (result.illustrationUrl) {
            slot.innerHTML = `
              <img src="${result.illustrationUrl}" alt="${esc(shot.topic)}" class="article-illustration-img" />
              <div class="article-illustration-caption">
                <span class="caption-topic">${esc(shot.topic)}</span>
                <span class="caption-meaning">${esc(shot.meaning || '')}</span>
              </div>
              <div class="article-illustration-actions">
                <button class="btn btn-xs" onclick="downloadArticleImg(this, '${esc(shot.topic)}')">下载</button>
                <button class="btn btn-xs btn-ghost" onclick="togglePrompt(this)">提示词</button>
                <div class="prompt-popover" style="display:none">${esc(shot.prompt || '')}</div>
              </div>
            `;
            slot.classList.remove("loading");
            return true;
          } else {
            slot.innerHTML = `<p class="img-error">配图生成失败</p>`;
            slot.classList.remove("loading");
            return false;
          }
        } catch (err) {
          slot.innerHTML = `<p class="img-error">生成失败：${err.message}</p>`;
          slot.classList.remove("loading");
          return false;
        }
      });

      const results = await Promise.all(generatePromises);
      const successCount = results.filter(Boolean).length;
      showToast(`已生成 ${successCount}/${shots.length} 张配图`);
    } catch (error) {
      console.error(error);
      illustrationLoading.innerHTML = `<p>生成失败：${error.message}</p>`;
      showToast("生成失败");
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "生成配图";
    }
  }

  // Render article with illustrations inserted
  function renderArticle(content, summary, shots) {
    // Split content into paragraphs
    const paragraphs = content.split(/\n+/).filter(p => p.trim());
    const totalParagraphs = paragraphs.length;
    const totalShots = shots.length;

    // Calculate where to insert each illustration
    const insertPoints = [];
    if (totalShots > 0 && totalParagraphs > 0) {
      // Distribute illustrations evenly, but first one goes after first paragraph
      for (let i = 0; i < totalShots; i++) {
        const afterParagraph = Math.floor((i + 1) * totalParagraphs / (totalShots + 1));
        insertPoints.push({ after: afterParagraph, shotIndex: i });
      }
    }

    let html = '';

    // Summary header
    if (summary) {
      html += `<div class="article-summary">
        <div class="article-summary-label">📋 文章摘要</div>
        <p>${esc(summary)}</p>
      </div>`;
    }

    // Article body with illustrations
    html += '<div class="article-body">';
    paragraphs.forEach((para, i) => {
      html += `<p class="article-paragraph">${esc(para)}</p>`;

      // Check if we should insert an illustration after this paragraph
      const insert = insertPoints.find(ip => ip.after === i);
      if (insert) {
        const shot = shots[insert.shotIndex];
        html += `<div class="article-illustration loading" data-slot="${insert.shotIndex}">
          <div class="illustration-placeholder">
            <div class="spinner-lg"></div>
            <p>正在生成配图：${esc(shot.topic)}...</p>
          </div>
        </div>`;
      }
    });
    html += '</div>';

    return html;
  }

  // Download article illustration
  window.downloadArticleImg = function(btn, topic) {
    const img = btn.closest(".article-illustration").querySelector("img");
    if (!img || !img.src) return;
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `${topic || "illustration"}.png`;
    a.click();
  };

  // Toggle prompt popover
  window.togglePrompt = function(btn) {
    const popover = btn.nextElementSibling;
    if (popover) {
      popover.style.display = popover.style.display === "none" ? "block" : "none";
    }
  };

  // Copy text helper
  window.copyText = function(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text);
    showToast("已复制");
  };

  // Helpers
  function animateValue(id, target) {
    const el = document.getElementById(id);
    const duration = 600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function sum(arr, key) {
    return (arr || []).reduce((t, i) => t + Number(i[key] || 0), 0);
  }

  function fmt(n) {
    return new Intl.NumberFormat("zh-CN", { notation: n > 9999 ? "compact" : "standard" }).format(n);
  }

  function formatDate(v) {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
  }

  function esc(s) {
    return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function escAttr(s) {
    return esc(String(s || "").startsWith("http") ? s : "");
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function toMarkdown(r) {
    const q = (r.questions || []).map((i, n) => `${n + 1}. [${i.title}](${i.url}) - 关注 ${i.followers || 0} / 回答 ${i.answers || 0}`).join("\n");
    const ideas = (r.ideas || []).map((i, n) => `${n + 1}. ${i.platform}：${i.title}\n   ${i.angle}`).join("\n");
    return `# ${r.keyword} 趋势洞察\n\n## 摘要\n${r.summary}\n\n## 标签\n${(r.tags || []).join("、")}\n\n## 用户痛点\n${(r.pains || []).map(p => `- ${p}`).join("\n")}\n\n## 问题池\n${q}\n\n## 选题建议\n${ideas}\n`;
  }

  // Init
  loadHotList();
  loadResourceStats();
})();
