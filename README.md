<div align="center">

<img src="https://img.shields.io/badge/status-alive-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/deploy-cloudflare%20pages-f38020?style=for-the-badge&logo=cloudflare" />

</div>

# ☀️ dayroom — 你的私人数字休息室

> 待办 × AI × 音乐 · 三合一个人工作站

<p align="center">
  <img src="https://img.shields.io/badge/待办事项-共享同步-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/AI聊天-DeepSeek驱动-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/音乐-放松+点歌-6c5ce7?style=flat-square" />
  <img src="https://img.shields.io/badge/暗色紫色调-暗黑-1a1a2e?style=flat-square" />
</p>

---

## ✨ 三个模块，一个页面

| 🗂️ 待办事项 | 🤖 AI 聊天 | 🎵 音乐播放器 |
|:---:|:---:|:---:|
| 多人共享同步 | 微信风格对话 | 放松频道 + 搜索点歌 |
| JSON Blob 云端存储 | 自定义 AI 角色 | B 站 + 酷我音源 |
| URL hash 一键分享 | 解锁无限模式 | 全局快捷键控制 |

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

## 🔒 AI 解锁

聊天窗口右上角 🔒 按钮，输入密码即可解锁无限制模式（max_tokens 8192）

---

<p align="center">
  <sub>Built with ❤️ by sheep eater killer</sub>
</p>
