# 知乎洞察雷达

知乎洞察雷达是一个开源的中文知识发现与内容选题工具。它面向创作者、产品经理、研究员和运营同学，用知乎开放 API 或兼容搜索接口，把关键词相关的问题、讨论热度、用户痛点和选题机会整理成一个可以直接阅读和导出的趋势报告。

**在线访问**：<https://zhihu.shoppilot.help/>

## 环境变量

在项目根目录创建 `.env.local` 文件（本地开发）或在 Vercel/部署平台配置以下变量：

```bash
# 知乎搜索 API（必填）
ZHIHU_SEARCH_URL=https://your-zhihu-open-api.example.com/search
ZHIHU_API_KEY=你的知乎开放 API Key
ZHIHU_BASE_URL=https://developer.zhihu.com/api/v1

# NVIDIA AI 分析（必填，用于 AI 深度分析功能）
NVIDIA_API_KEY=你的NVIDIA API Key
# 以下为可选配置
NVIDIA_API_ENDPOINT=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=minimaxai/minimax-m3
```

NVIDIA API Key 免费获取：<https://build.nvidia.com>

## 核心功能

### 洞察雷达
- 关键词搜索分析，自动调用知乎 API
- AI 深度分析：趋势摘要、用户痛点、选题建议
- 问题池展示，包含关注数、回答数和机会等级
- 一键复制 Markdown 报告

### 实时热榜
- 对接知乎热榜 TOP50
- 关键词过滤
- 服务端缓存 1 小时
- 热榜数据自动加载

### 网盘推广系统
- 热榜话题一键生成资源推荐页
- AI 自动生成资源文案
- 批量生成（Top 5 热榜话题）
- 每个资源页独立 SEO URL：`/resource/:id`
- 支持夸克网盘、百度网盘、阿里云盘
- 动态 Sitemap 自动生成
- 浏览量统计

## 推广平台配置

编辑 `data/promotions.json` 配置推广链接：

```json
{
  "platforms": [
    {
      "id": "quark",
      "name": "夸克网盘",
      "icon": "夸",
      "color": "#6a5acd",
      "url": "https://pan.quark.cn/s/你的推广码",
      "description": "注册即送1TB空间",
      "keywords": ["影视", "小说", "壁纸"],
      "enabled": true
    }
  ],
  "defaultPlatform": "quark"
}
```

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/search?q=关键词` | GET | 搜索知乎并返回标准化报告 |
| `/api/hot` | GET | 获取知乎热榜 TOP50 |
| `/api/analyze` | POST | AI 深度分析 |
| `/api/promotions` | GET | 获取推广配置 |
| `/api/promotions?action=resources` | GET | 获取所有资源页 |
| `/api/promotions` | POST | 创建资源页 |
| `/api/resource` | POST | AI 生成资源文案 |
| `/api/sitemap` | GET | 动态 Sitemap（含资源页） |

## 本地运行

```bash
# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 API Key

# 启动服务
node server.js

# 访问
http://localhost:8080
```

## Vercel 部署

1. 导入 GitHub 仓库到 Vercel
2. 配置环境变量
3. 部署后访问你的域名

## 项目结构

```text
.
├── api
│   ├── search.js      # 搜索 API
│   ├── hot.js         # 热榜 API
│   ├── analyze.js     # AI 分析 API
│   ├── promotions.js  # 推广链接管理
│   ├── resource.js    # 资源页生成
│   └── sitemap.js     # 动态 Sitemap
├── data
│   ├── promotions.json # 推广平台配置
│   └── resources.json  # 已生成资源页
├── public
│   ├── index.html
│   ├── resource.html   # 资源页模板
│   └── assets/
├── server.js
├── vercel.json
└── README.md
```

## SEO 优化

- 每个资源页独立 URL：`/resource/:id`
- 自动生成 title、description、keywords
- Open Graph 标签支持社交分享
- 动态 Sitemap 包含所有资源页
- 结构化数据标记

## 开源协议

MIT License
