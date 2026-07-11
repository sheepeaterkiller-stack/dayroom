<div align="center">

<img src="https://img.shields.io/badge/status-alive-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/deploy-cloudflare%20pages-f38020?style=for-the-badge&logo=cloudflare" />

</div>

# ☀️ dayroom — 你的私人数字休息室

> 待办 × AI × 音乐 · 三合一个人工作站

<p align="center">
  <img src="https://img.shields.io/badge/待办事项-共享同步-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/AI聊天-拟人化角色-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/音乐-放松+点歌-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/AI写作-长篇创作-ff6b6b?style=flat-square" />
  <img src="https://img.shields.io/badge/暗色紫色调-暗黑-1a1a2e?style=flat-square" />
</p>

---

## ✨ 三个模块，一个页面

| 🗂️ 待办事项 | 💬 AI 聊天 | 🎵 音乐播放器 |
|:---:|:---:|:---:|
| 多人共享同步 | 微信风格对话 | 放松频道 + 搜索点歌 |
| JSON Blob 云端存储 | 自定义 AI 角色 | B 站 + 酷我音源 |
| URL hash 一键分享 | 解锁无限模式 | 全局快捷键控制 |

---

## 🖋️ AI 创意写作 ✨ 亮点功能

dayroom 的 AI 不只是聊天——它还能**创作长篇内容**。基于 DeepSeek 大模型，配合自定义角色系统，你可以让 AI 帮你写小说、剧本、文章、文案……任何文字创作。

### 📚 代表作品：《欲痕大陆：七罪之源》

> 一部由 dayroom AI 创作的暗黑奇幻长篇巨著 · 32 章 · 约 35 万字 · 🚧 持续更新中

这是一部宏大的史诗级奇幻小说，构建了一个被七原罪主宰的堕落世界。AI 从零开始搭建了完整的世界观——七个领域、五类种族、复杂的人物关系网——然后一章接一章地展开故事的叙事，角色在其中挣扎、成长、蜕变。

👉 **[📖 立即阅读 →](novel/欲痕大陆-七罪之源.md)**

```
🏰 七大领域  ·  👥 多位核心角色  ·  🌍 完整世界观  ·  📖 32章持续连载
```

### 🎯 你也可以

- 🎭 **创建专属写作角色** — 设定性格、风格、专长领域
- 📝 **开始你的创作** — 小说、同人、剧本、诗歌……无限制
- 🔓 **解锁无限模式** — 更长记忆，更深度的内容生成
- 💾 **一键备份导出** — 你的作品永远属于你

---

## 🚀 快速开始

```bash
# 直接用浏览器打开
start index.html

# 或者跑个本地服务器
npx serve .
```

> 🌐 线上站: **[dayroom-50g.pages.dev](https://dayroom-50g.pages.dev)**

---

## 🧩 技术栈

```
HTML + CSS + JS  ·  Cloudflare Pages Functions  ·  DeepSeek API  ·  IndexedDB
```

---

## 🗂️ 项目结构

```
├── index.html              # 主页面（待办 + AI聊天 + 音乐）
├── style.css               # 样式表
├── bg.mp4                  # 默认动态背景
├── functions/              # Cloudflare Pages Functions
│   ├── api.js              # Todo CRUD（JSON Blob 代理）
│   ├── chat.js             # AI 聊天（DeepSeek + 天气/运势/笑话）
│   └── music.js            # 音乐搜索（hige.com 代理）
├── novel/                  # AI 创意写作作品
│   └── 欲痕大陆-七罪之源.md  # 长篇奇幻小说（32章·35万字·连载中）
├── netlify/functions/      # Netlify Functions（已弃用，保留备份）
├── DESIGN.md               # 设计规范
└── package.json            # wrangler 部署依赖
```

---

## 🚢 部署

```bash
# 设置凭证
export CLOUDFLARE_API_TOKEN=<your-token>
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# 部署（必须加 --branch=main 否则 Secrets 不可用）
npx wrangler pages deploy . --project-name dayroom --branch=main --commit-dirty=true
```

**Cloudflare Secret:** `DEEPSEEK_API_KEY` 需通过 `wrangler pages secret put` 设置。

---

## ⌨️ 快捷键

| 按键 | 功能 |
|:---:|:---:|
| `Space` | 音乐 播放/暂停 |
| `↑` `↓` | 音量 增大/减小 |

---

## 🧑 拟人化角色

**三个默认角色：**

| 角色 | 头像 | 说明 |
|:---|:---:|:---|
| 周图 | 💡 | 随性自然的朋友，聊科技、电影、音乐、游戏 |
| 小说助理 | 📖 | 专业创作档案管理，追踪角色/伏笔/世界观 |
| AI写作助手 | 🖋️ | 三位一体·叙事空间创作系统 v3.0 — 完整商业网文创作工作流 |

侧边栏自定义角色入口 🎭，创建专属聊天对象。聊天窗口右上角 🔒 按钮解锁无限制模式。



---

<p align="center">
  <sub>Built with ❤️ by sheep eater killer</sub>
</p>
