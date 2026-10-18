<div align="center">

# ☀️ dayroom — 你的私人数字多维工作站

> **AI 创作 · 角色卡工作台 · 酷我全网音乐 · Live2D 桌面萌宠 · 开发者工具箱 · 动态氛围壁纸**

<p align="center">
  <a href="https://dayroom-50g.pages.dev" target="_blank">
    <img src="https://img.shields.io/badge/Online%20Demo-dayroom--50g.pages.dev-00b894?style=for-the-badge&logo=cloudflare" alt="Online Demo" />
  </a>
  <img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-f38020?style=for-the-badge&logo=cloudflare" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/AI%20Engine-DeepSeek%20%7C%20Gemini-6c5ce7?style=for-the-badge" alt="AI Engine" />
  <img src="https://img.shields.io/badge/Mascot-Live2D%20Cubism-ff7675?style=for-the-badge" alt="Live2D" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/原生多模态视觉-DeepSeek%20Flash-0984e3?style=flat-square" />
  <img src="https://img.shields.io/badge/服务端联网检索-DeepSeek%20Responses-00cec9?style=flat-square" />
  <img src="https://img.shields.io/badge/角色卡规范-Chub%20%2F%20CCv3-fd79a8?style=flat-square" />
  <img src="https://img.shields.io/badge/全网音乐源-酷我官方无损接口-e17055?style=flat-square" />
  <img src="https://img.shields.io/badge/UI设计-Glassmorphism%20毛玻璃-6c5ce7?style=flat-square" />
</p>

<p align="center">
  <a href="#-核心功能矩阵">核心功能</a> •
  <a href="#-拟人化角色与模型矩阵">角色矩阵</a> •
  <a href="#-角色卡工作台-v2">角色卡工作台</a> •
  <a href="#-音乐电台与播放引擎">音乐电台</a> •
  <a href="#-桌面-live2d-萌宠">桌面萌宠</a> •
  <a href="#-长篇创意写作展示">代表作品</a> •
  <a href="#-部署与配置">部署指南</a>
</p>

</div>

---

## 🌟 项目简介

**dayroom** 是一个集 **深度 AI 对话创作、沉浸式角色卡工作台、全网无损音乐电台、Live2D 陪伴萌宠、实用生产力工具箱与动态沉浸氛围壁纸** 于一体的高美感单页 Web 应用。

无论你是想要专注码字创作、与细腻生动的拟人角色畅聊、搭建属于自己的二次元角色卡世界，还是在清雅的背景乐与桌面小宠的陪伴下高效学习工作，dayroom 都能为你提供兼具实用价值与视觉享受的数字栖息空间。

---

## 🎛️ 核心功能矩阵

```
┌────────────────────────────────────────────────────────────────────────┐
│                               dayroom                                  │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│   💬 智能AI对话   │  🎴 角色卡工作台  │   🎵 音乐休闲电台 │  🐾 桌面萌宠   │
│  - DeepSeek视觉   │  - CCv3/PNG解析  │  - 酷我全网直连   │  - 昼夜自适应  │
│  - 原生联网检索   │  - 双向状态面板   │  - 双播放源互斥   │  - 6大互动Dock │
│  - 4大拟人预设    │  - R18智能打标   │  - 3态循环+频谱   │  - 摸鱼贪吃蛇  │
├──────────────────┴──────────────────┴──────────────────┴───────────────┤
│   🧰 实用工具箱 (225+ 工具导航)  │  🌌 动态氛围壁纸 (引力星云/本地上传)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. 💬 智能 AI 对话与创意空间
- **双大模型智能路由**：
  - **DeepSeek V4.1**：默认高能引擎，支持**原生多模态视觉看图**（直接发送图片解析）与**原生 Responses 服务端联网检索**（实时资讯精准解答）。
  - **Google Gemini 3.6 Flash**：支持在角色设置中一键按需切换，体验多元化思考风格。
- **4 大内置拟人化角色**：各具独特语气与长驻 Prompt（周图、小说助理、AI写作助手、TODO 效率助手）。
- **无限制创作模式（锁屏鉴权）**：输入管理密钥解锁，解除常规对话长度限制，支持长达几十万字的长篇小说深潜连载。
- **对话全量归档**：基于本地浏览器 `IndexedDB` 独立持久化归档，安全无泄露。

### 2. 🎴 角色卡工作台 v2 (Rolecard Workbench)
- **纯前端 CCv3 / PNG 角色卡无损导入**：
  - 支持 Tavern / Chub 标准角色卡格式，自动提取并清洗 PNG `tEXt` 块中的 Base64 元数据（兼容 `chara` 与 `ccv3` 规范）。
- **两级沉浸式视图**：
  - **画廊视图**：角色卡瀑布流卡片展示，支持搜索、R18 标签切换与卡片管理。
  - **全屏聊天视图**：微拟物对话气泡、沉浸式背景与双向宏变量替换（`{{user}}` / `{{char}}`）。
- **动态状态面板（HUD）**：
  - 角色对话末尾输出 `【状态面板】{JSON}` 自动剥离并解析为生命值、好感度、理智值、情绪状态等进度条。
  - 状态实时回传下一轮 Prompt，实现游戏级互动养成。
- **预置高质量卡片**：内置预置角色卡（如黑长直冷艳同桌·苏璃 `rc_suri` 等）。

### 3. 🎵 音乐休闲电台 (Music Station)
- **酷我官方全网原生引擎**：
  - 后端直接对接酷我官方搜索与高防 CDN 直连解析，秒出音频流，免登录、免 VIP 限制、全球流畅直连。
- **双音源互斥播放引擎**：
  - **放松频道**：精选 Lo-fi、纯音乐钢琴、助眠雨声、沉浸氛围等 12 组高清电台。
  - **搜索点歌**：支持歌名、歌手全网模糊搜索，一键试听、加入播放列表。
  - **互斥守护**：切换频道、切歌或模式切换时，自动静默暂停另一音源，杜绝双声重叠。
- **3 态播放模式 & 双音量联动**：
  - 支持 `🔁 列表循环`、`🔂 单曲循环`、`🔀 随机播放`（Fisher-Yates 算法），自动记忆持久化。
  - 双模式音量控制条双向联动，支持一键静音/还原。
- **实时动效**：Canvas 音频频谱跳动波形与 Bilibili 视屏伴奏抽屉。

### 4. 🐾 桌面常驻 Live2D 萌宠 (Desktop Companion)
- **昼夜环境自适应**：
  - 随网站 Day / Night 主题联动：**夜晚陪伴·黑猫 Hijiki** (Model 0) ↔ **晨曦元气·柴犬 Wanko** (Model 1)。
  - 接入平滑淡出微缩放动效，告别生硬突兀跳变。
  - 支持鼠标长按自由贴底拖拽位置。
- **全新悬浮毛玻璃 Capsule Dock（6 大交互功能）**：
  - 💬 **倾听一言**：拉取治愈、哲思名句并在气泡分段展示出处与作者。
  - 💖 **摸摸治愈**：触发 Live2D 专属动作，猫咪发出舒适呼噜踩奶、柴犬欢快摇尾贴贴。
  - 🍵 **贴心管家**：针对久坐办公，随机提醒温水补水、脊椎放松、远眺护眼、伸展懒腰与能量补充。
  - 🐾 **切换萌宠**：生动爪印图标，一键手动在黑猫与柴犬间热切换。
  - 🎮 **摸鱼游戏**：现代手柄图标，一键拉起全屏经典贪吃蛇小游戏。
  - ✕ **宠物休息**：温柔道别并淡出，左下角留存唤醒按钮随时召唤。
- **纯 CSS 悬浮微气泡 Tooltip**：悬浮向外优雅展示气泡，不遮挡宠物本身，完美适配白天模式。

### 5. 🧰 实用工具箱 (Toolbox)
- 收录 **225+ 款**高频实用在线工具导航，涵盖：
  - **文本与开发**：代码格式化、加解密、JSON 处理、正则校验、Markdown 编辑器等。
  - **图像与多媒体**：图片压缩、格式转换、音视频剪辑、调色盘。
  - **生活与财务**：汇率换算、房贷计算、时间戳工具、便民查询。
  - **CSS 与益智**：渐变生成器、动画调试、益智休闲小工具。

### 6. 🌌 动态壁纸与氛围引擎 (Wallpaper & Themes)
- **预设丰富氛围**：
  - **引力星云（Nebula，默认低耗首选）**：优雅的深邃粒子星云动效。
  - **极光 & 星轨**：沉浸式梦幻夜空光影。
  - **高清视频背景**：精选 `bg.mp4` 动态流体光幕。
- **本地自定义上传（100MB+）**：
  - 支持用户自主上传本地图片或视频作为常驻壁纸，通过 `IndexedDB` 本地存储并自动生成缩略图，保护隐私且不消耗网络带宽。
- **昼夜果冻开关**：Day / Night 主题一键无缝切换，界面背景、文字对比度与萌宠全站联动。

---

## 🧑 拟人化角色与模型矩阵

| 角色 | 头像 | 适用模型 | 角色定位与擅长领域 |
| :--- | :---: | :---: | :--- |
| **周图** | 💡 | DeepSeek / Gemini | 随性幽默的密友，聊日常、科技圈、影视杂谈、生活闲聊、天气与笑话。 |
| **小说助理** | 📖 | DeepSeek | 专业的网文与文学创作顾问，擅长世界观架构、人物大纲整理与伏笔编织。 |
| **AI写作助手** | 🖋️ | DeepSeek Flash | 三位一体·叙事空间创作系统成人增强版，长篇深度生成、剧情张力拉满。 |
| **TODO** | 🔥 | DeepSeek | 效率管理与任务拆解管家，将庞杂的项目需求拆解为结构化可执行事项。 |
| **角色卡自定义** | 🎴 | DeepSeek / Gemini | 角色卡工作台任意导入，支持玩家自定义专属性格、开场白与属性面板。 |

---

## 📚 长篇创意写作展示

dayroom 不仅能处理日常问答，更拥有驾驭**几十万字长篇宏大叙事**的能力。

### 📖 代表作品：《欲痕大陆：七罪之源》
> **一部由 dayroom AI 深度共创的暗黑史诗奇幻长篇 · 32 章 · 约 35 万字**

- **宏大架构**：从零构建七原罪主宰的堕落世界（七大领域、五大种族、神权与深渊权谋）。
- **立体群像**：严谨追踪每位角色的宿命抉择、暗黑蜕变与情感纠葛。
- 👉 **[📖 点击在线阅读全文 →](novel/欲痕大陆-七罪之源.md)**

---

## ⌨️ 全局快捷键指南

| 快捷键 | 作用场景 | 交互功能 |
| :---: | :---: | :--- |
| `Space` (空格) | 全局任意位置 | **音乐播放 / 暂停智能路由**（优先控制当前正在播放的音频源） |
| `↑` `↓` (上下键) | 全局任意位置 | **音乐音量调节**（微调步进，且与双音量条双向同步） |
| `Esc` | 任意弹窗 / 抽屉 | **一键退出或关闭**（音乐抽屉、工具箱、角色卡工作台等） |

---

## 📁 项目目录结构

```
dayroom/
├── index.html                  # 核心单页 HTML（整合聊天、工具箱、壁纸与角色卡工作台）
├── style.css                   # 全站主样式表（Glassmorphism 毛玻璃与昼夜主题系统）
├── bg.mp4                      # 预设高清动态流体视频壁纸
├── net.js                      # 网络请求助手
├── vision.js                   # 本地视觉解析测试脚本
├── functions/                  # Cloudflare Pages Functions 后端轻量服务
│   ├── chat.js                 # AI 聊天路由（DeepSeek原生视觉/联网 + Gemini + 天气笑话）
│   ├── music.js                # 酷我官方全网音乐检索与无损直链解析接口
│   ├── fetch.js                # 网络资源代理透传服务
│   └── tts.js                  # 语音合成支持服务
├── waifu/                      # Live2D 桌面萌宠模块
│   ├── autoload.js             # 萌宠按需加载器、昼夜联动与拖拽引擎
│   ├── waifu-tips.js           # 萌宠交互控制器（6大功能 Dock、气泡播报、动作触发）
│   ├── waifu-tips.json         # 悬浮与互动文案配置表
│   ├── waifu.css               # 萌宠与悬浮毛玻璃 Dock 样式表
│   ├── snake.js                # 摸鱼小游戏：全屏经典贪吃蛇
│   └── models/                 # Live2D 模型资源库
│       ├── hijiki/             # 夜间萌宠：小黑猫 Hijiki (Cubism 2)
│       └── wanko/              # 白天萌宠：小柴犬 Wanko (Cubism 2)
├── rolecards/                  # 角色卡静态资源
│   └── suri.png                # 预置角色卡：苏璃
├── previews/                   # 界面截图与视觉预览归档
├── novel/                      # AI 创意写作作品集
│   └── 欲痕大陆-七罪之源.md      # 35万字暗黑奇幻长篇巨著
└── package.json                # Wrangler 部署与开发依赖
```

---

## 🚀 本地开发与快速运行

本站为现代化原生轻量架构，无需复杂的打包构建流程：

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/dayroom.git
cd dayroom

# 2. 方式 A：直接使用现代浏览器打开 index.html 即可体验大部分前端功能
start index.html

# 3. 方式 B：启动本地静态服务器（推荐测试音乐与模型加载）
npx serve .
```

---

## 🚢 部署与环境变量配置

本项目完全适配 **Cloudflare Pages**，全球 Anycast CDN 边缘极速直连。

### 1. 命令行一键部署
```bash
# 设置 Cloudflare 凭证
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"

# 部署至 Cloudflare Pages（生产分支 main）
npx wrangler pages deploy . --project-name dayroom --branch=main --commit-dirty=true
```

### 2. 环境变量 (Cloudflare Secrets)
在 Cloudflare Pages 项目后台 `Settings` → `Variables and Secrets` 中配置以下密钥：

| 变量名 | 必填 | 说明 |
| :--- | :---: | :--- |
| `DEEPSEEK_API_KEY` | **是** | DeepSeek 官方 API 密钥（驱动对话、原生看图多模态与联网搜索） |
| `GEMINI_API_KEY` | 选填 | Google AI Studio 密钥（驱动 Gemini 模型切换） |
| `CHAT_ADMIN_KEY` | 选填 | 对话窗口解锁无限制长篇模式的管理密码 |
| `ZHANGYA_MODEL` | 选填 | AI 写作助手专属模型覆盖（默认 fallback 为 `deepseek-flash`） |

---

## 📄 开源许可证

本项目采用 MIT 许可证开源。请尽情自由探索、魔改属于你自己的数字休息室！

<div align="center">
  <sub>Built with ❤️ by sheep eater killer · 2026</sub>
</div>
