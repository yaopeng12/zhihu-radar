# 知乎洞察雷达

知乎洞察雷达是一个开源的中文知识发现与内容选题工具。它面向创作者、产品经理、研究员和运营同学，用知乎开放 API 或兼容搜索接口，把关键词相关的问题、讨论热度、用户痛点和选题机会整理成一个可以直接阅读和导出的趋势报告。

**在线访问**：<https://zhihu.shoppilot.help/>

## 环境变量

在项目根目录创建 `.env.local` 文件（本地开发）或在 Vercel/部署平台配置以下变量：

```bash
# 知乎搜索 API（必填）
ZHIHU_SEARCH_URL=https://your-zhihu-open-api.example.com/search
ZHIHU_API_KEY=你的知乎开放 API Key

# 知乎全局搜索（可选，默认使用 developer.zhihu.com）
ZHIHU_GLOBAL_SEARCH_URL=https://developer.zhihu.com/api/v1/content/global_search

# 知乎热榜（可选，默认使用 zhihu.com 热榜接口）
ZHIHU_HOT_LIST_URL=https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total

# NVIDIA AI 分析（必填，用于 AI 深度分析功能）
NVIDIA_API_KEY=你的NVIDIA API Key
# 以下为可选配置
NVIDIA_API_ENDPOINT=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=minimaxai/minimax-m3
```

NVIDIA API Key 免费获取：<https://build.nvidia.com>

## 当前功能

- 关键词分析工作台
- 演示数据模式，GitHub Pages 可直接运行
- Vercel Function 服务端代理：`/api/search`
- 默认热度优先：合并 `zhihu_search` 与 `global_search` 候选，按 `RankingScore`、赞同数、评论数综合排序
- **AI 深度分析**：搜索后自动调用 NVIDIA NIM MiniMax M3 生成趋势摘要、用户痛点和选题建议
- 趋势摘要、标签、痛点和内容机会展示
- 问题池表格，包含关注数、回答数和机会等级
- 选题建议卡片，覆盖公众号、小红书、B 站、播客等场景
- **实时热榜监控**：对接知乎热榜 TOP50，支持关键词过滤和自动刷新
- 一键复制 Markdown 报告
- 无构建依赖，适合 GitHub Pages、Nginx、Docker 静态托管

## 本地运行

1. 配置环境变量：

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Key
```

2. 启动服务：

```bash
node server.js
```

3. 访问：

```
http://localhost:8080
```

## Vercel 部署

1. 导入 GitHub 仓库到 Vercel
2. 在 Vercel 项目的 Environment Variables 中配置上述环境变量
3. 部署后访问你的 Vercel 域名

## Docker 部署

```bash
docker build -t zhihu-radar .
docker run --rm -p 8080:8080 \
  -e ZHIHU_SEARCH_URL="https://your-zhihu-open-api.example.com/search" \
  -e ZHIHU_API_KEY="你的知乎开放 API Key" \
  -e NVIDIA_API_KEY="你的NVIDIA API Key" \
  zhihu-radar
```

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/search?q=关键词` | GET | 搜索知乎并返回标准化报告 |
| `/api/hot` | GET | 获取知乎热榜 TOP50 |
| `/api/hot?keyword=AI` | GET | 关键词过滤热榜 |
| `/api/analyze` | POST | AI 深度分析（自动生成） |

## 项目结构

```text
.
├── api
│   ├── search.js      # 搜索 API
│   ├── hot.js         # 热榜 API
│   └── analyze.js     # AI 分析 API
├── public
│   ├── index.html
│   └── assets
│       ├── app.js
│       ├── sample-data.js
│       └── styles.css
├── server.js          # 本地开发服务器
├── vercel.json
├── Dockerfile
└── README.md
```

## 开源协议

MIT License
