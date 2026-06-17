# 知乎洞察雷达

知乎洞察雷达是一个开源的中文知识发现与内容选题工具。它面向创作者、产品经理、研究员和运营同学，用知乎开放 API 或兼容搜索接口，把关键词相关的问题、讨论热度、用户痛点和选题机会整理成一个可以直接阅读和导出的趋势报告。

在线访问页面：

- GitHub 仓库：<https://github.com/yaopeng12/zhihu-radar>
- Vercel 真实 API 部署：配置 `ZHIHU_SEARCH_URL` 后访问你的 Vercel 域名
- 首页 / 工作台：`/`
- 搜索 API：`/api/search?q=AI%20Agent`
- 总览区：<(https://zhihu-radar.vercel.app>
- 问题池：<https://zhihu-radar.vercel.app>
- 选题建议：<https://zhihu-radar.vercel.app>
- 导出区：<https://zhihu-radar.vercel.app>

## 解决什么问题

在知乎上做研究通常会遇到这些问题：

- 搜索结果很多，但很难快速判断哪些问题值得继续追踪。
- 创作者需要找到高关注、强痛点、还没有被充分回答的选题。
- 产品和运营同学想了解用户真实疑问，却不想手工复制整理。
- 团队希望有一个可自托管、可二次开发、可接入多个数据源的工具。

知乎洞察雷达把这些流程整理成一个轻量工作台：输入关键词，得到趋势摘要、问题池、痛点列表和平台化选题建议。

## 当前功能

- 关键词分析工作台
- 演示数据模式，GitHub Pages 可直接运行
- Vercel Function 服务端代理：`/api/search`
- 可配置知乎 API 搜索接口：`ZHIHU_SEARCH_URL`
- 支持服务端 `ZHIHU_API_KEY`，也支持页面临时传入 API Key
- 趋势摘要、标签、痛点和内容机会展示
- 问题池表格，包含关注数、回答数和机会等级
- 选题建议卡片，覆盖公众号、小红书、B 站、播客等场景
- 一键复制 Markdown 报告
- 无构建依赖，适合 GitHub Pages、Nginx、Docker 静态托管

## 在线演示与真实部署

GitHub Pages 只能托管静态文件，不能安全保存 API Key，也不能运行服务端代理。因此 GitHub Pages 地址适合作为 UI 演示。

真实知乎 API 流程请部署到 Vercel 或其他支持 Serverless Functions 的平台：

```text
浏览器 -> /api/search?q=关键词 -> Vercel Function -> 知乎开放 API -> 标准化趋势报告
```

如果你把这个仓库部署到 GitHub Pages，访问地址通常是：

```text
https://yaopeng12.github.io/zhihu-radar/
```

项目包含 `.github/workflows/pages.yml`。推送到 GitHub 后，在仓库的 `Settings -> Pages` 中把 Source 设置为 `GitHub Actions`，之后每次推送 `main` 分支都会自动部署静态演示。

## Vercel 部署真实流程

1. 导入 GitHub 仓库到 Vercel。
2. 在 Vercel 项目的 Environment Variables 中配置：

```text
ZHIHU_SEARCH_URL=https://your-zhihu-open-api.example.com/search
ZHIHU_API_KEY=你的知乎开放 API Key
```

3. 部署后访问：

```text
https://your-project.vercel.app/
https://your-project.vercel.app/api/search?q=AI%20Agent
```

如果不想在服务端保存 key，也可以只配置 `ZHIHU_SEARCH_URL`，然后在页面左侧的“知乎 API Key”输入框临时填写。这个 key 只会保存在当前浏览器的 localStorage 中，并通过 `x-zhihu-api-key` 请求头传给 `/api/search`。

## 本地运行

如果只看 UI，可以直接打开 `public/index.html`。如果要测试真实 `/api/search` 流程，请使用 Node 服务：

```bash
node server.js
```

然后访问：

```text
http://localhost:8080
http://localhost:8080/api/search?q=AI%20Agent
```

## 接入知乎开放 API 或兼容接口

浏览器端不应该直接保存平台 API Key。推荐做法是使用项目内置的服务端代理：

```text
GET /api/search?q=AI%20Agent
```

`/api/search` 会调用 `ZHIHU_SEARCH_URL`，并把知乎开放 API 的返回结果标准化成下面这种结构：

```json
{
  "keyword": "AI Agent",
  "summary": "这里是趋势摘要",
  "tags": ["工具效率", "职业影响"],
  "pains": ["用户痛点 1", "用户痛点 2"],
  "questions": [
    {
      "title": "AI Agent 到底解决了什么真实问题？",
      "url": "https://www.zhihu.com/question/xxx",
      "followers": 12800,
      "answers": 243,
      "opportunity": "高"
    }
  ],
  "ideas": [
    {
      "platform": "公众号",
      "title": "AI Agent 没有那么神，但这 5 个场景已经值得用",
      "angle": "用真实业务场景拆解价值。"
    }
  ]
}
```

如果你的知乎开放 API 返回字段不是 `data` / `results` / `items` / `list` 这几类常见结构，可以改 `api/search.js` 里的 `extractItems` 和 `normalizeItem` 两个函数做适配。

## Docker 部署

```bash
docker build -t zhihu-radar .
docker run --rm -p 8080:8080 \
  -e ZHIHU_SEARCH_URL="https://your-zhihu-open-api.example.com/search" \
  -e ZHIHU_API_KEY="你的知乎开放 API Key" \
  zhihu-radar
```

访问：

```text
http://localhost:8080
```

## 项目结构

```text
.
├── api
│   └── search.js
├── public
│   ├── index.html
│   └── assets
│       ├── app.js
│       ├── sample-data.js
│       └── styles.css
├── .github
│   └── workflows
│       └── pages.yml
├── Dockerfile
├── LICENSE
├── package.json
├── server.js
└── README.md
```

## 路线图

- 增加官方知乎 API 代理模板
- 接入 OpenAI、DeepSeek、通义千问或 Ollama 生成摘要
- 支持关键词订阅和日报
- 支持 CSV、PDF、Notion、飞书导出
- 增加多数据源插件：微博、小红书、B 站、Reddit、Hacker News
- 增加 PostgreSQL/SQLite 存储，用于长期趋势跟踪

## 开源协议

MIT License
