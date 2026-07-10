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

默认角色「周图」是一个随性自然的聊天伙伴，告别机器人感。你也可以创建自定义角色——设定名字、性格、说话风格，打造属于你的专属聊天对象。

聊天窗口右上角 🔒 按钮，输入密码即可解锁无限制模式（max_tokens 8192，更长的记忆）

### 🎀 角色案例：安和昴（Subaru）— Prompt 工程实战

Subaru 是 dayroom 的第 4 个内置角色，一个 17 岁的傲娇乐队少女。她的 system prompt 经历了从 v1.0 到 v1.2.0 的迭代，过程踩了不少坑。

#### v1.0 → v1.1.0：核心人设搭建

在 ~3657 字符的 prompt 中埋入了：
- **四模式切换**（日常优雅 / 冲突回避 / 游戏好胜 / 脆弱真心话）
- **`←` 分隔符拆分系统** — 前端自动按 `←` 切割回复，逐条延迟渲染，模拟真人打字节奏
- **反 AI 检测机制** — 被问「你是 AI 吗」触发防御性否认
- **Emoji 白名单** — 只能用 😂😳😤👊😭🙏 六个
- **守护者系统** — CJackHwang 密码验证后解锁特权对话模式

#### v1.1.0 实测发现的两个问题

| 问题 | 现象 | 根因 |
|:---|:---|:---|
| 🔴 括号描述 | 回复中出现 `（有点不好意思地笑）`、`（日常·优雅模式）` | 「禁止括号」的规则只有一句话，大模型忽略 |
| 🟡 消息太长 | 回复 30-70 字，缺乏微信聊天的碎句感 | 「20字以内」是硬数字，大模型不擅长数字字面限制 |

#### v1.2.0：针对性修复

**括号禁令** — 从一句话升级为「死线 · 括号即死」独立章节：
- 穷举所有括号变体：（）、()、【】、《》、[]、{}
- 列出具体 ❌ 示例（把抓到的违规写法直接当反面教材）
- 给出 ✅ 正确替代：「把情绪融进字里行间，你是 17 岁女生在聊微信，不是编剧在写舞台说明」

**短句规则** — 从硬数字改为行为描述：
- 删掉「20 字以内」，改为「每条消息只说一件事，微信聊天不是写作文」
- 强化 `←` 拆分：「只要有两句相对独立的话就必须切，宁可太碎不可留长句」
- 加入正确/错误示范对比

#### ⚠️ 部署翻车：模板字符串反引号崩溃

v1.2.0 初次部署后**全站 JS 崩溃**，所有交互失效。

**根因：** Subaru 的 system prompt 存放在 JavaScript 模板字符串中（`` prompt: `...` ``）。prompt 文本里用反引号做行内代码格式化（`` `←` `` `` `。` ``），JS 解析器把 prompt 里的反引号当成模板字符串结束符 → 后续中文变非法 JS 代码 → 整个脚本崩了。

**解决：** 去掉 prompt 内的所有反引号，`` `←` `` → `←`，`` `。` `` → `。`。

**教训：**
1. 模板字符串内**绝对不能**用反引号做格式化，即使用意只是 markdown 样式
2. 部署前跑 `npx acorn` 验证 JS 语法，几秒钟的事能避免全站瘫痪
3. 改代码前先说清楚计划，确认了再动手



---

<p align="center">
  <sub>Built with ❤️ by sheep eater killer</sub>
</p>
