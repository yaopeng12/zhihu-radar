# 知乎洞察雷达

知乎洞察雷达是一个开源的中文知识发现与内容选题工具。它面向创作者、产品经理、研究员和运营同学，用知乎开放 API 或兼容代理接口，把关键词相关的问题、讨论热度、用户痛点和选题机会整理成一个可以直接阅读和导出的趋势报告。

在线访问页面：

- GitHub 仓库：<https://github.com/yaopeng12/zhihu-radar>
- 首页 / 工作台：<https://yaopeng12.github.io/zhihu-radar/>
- 总览区：<https://yaopeng12.github.io/zhihu-radar/#overview>
- 问题池：<https://yaopeng12.github.io/zhihu-radar/#questions>
- 选题建议：<https://yaopeng12.github.io/zhihu-radar/#ideas>
- 导出区：<https://yaopeng12.github.io/zhihu-radar/#export>

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
- 可配置知乎 API 代理端点
- 趋势摘要、标签、痛点和内容机会展示
- 问题池表格，包含关注数、回答数和机会等级
- 选题建议卡片，覆盖公众号、小红书、B 站、播客等场景
- 一键复制 Markdown 报告
- 无构建依赖，适合 GitHub Pages、Nginx、Docker 静态托管

## 在线演示

如果你把这个仓库部署到 GitHub Pages，访问地址通常是：

```text
https://yaopeng12.github.io/zhihu-radar/
```

项目包含 `.github/workflows/pages.yml`。推送到 GitHub 后，在仓库的 `Settings -> Pages` 中把 Source 设置为 `GitHub Actions`，之后每次推送 `main` 分支都会自动部署。

## 本地运行

因为项目是静态页面，可以直接打开 `index.html`。如果你想模拟线上环境：

```bash
python -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

## 接入知乎开放 API

浏览器端不应该直接保存知乎 API Key。推荐做法是自建一个服务端代理：

```text
GET /api/zhihu/search?q=AI%20Agent
```

代理接口返回下面这种结构即可被前端直接渲染：

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

前端页面左侧的“知乎 API 代理端点”填入你的代理 URL 后，会自动带上 `q` 查询参数。

## Docker 部署

```bash
docker build -t zhihu-radar .
docker run --rm -p 8080:80 zhihu-radar
```

访问：

```text
http://localhost:8080
```

## 项目结构

```text
.
├── index.html
├── assets
│   ├── app.js
│   ├── sample-data.js
│   └── styles.css
├── .github
│   └── workflows
│       └── pages.yml
├── Dockerfile
├── LICENSE
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
