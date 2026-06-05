# DESIGN.md

> 信息从黑暗中浮现，以极精密的亮度层级替代色彩喧嚣。Dark-native，克制到底。

## 1. Visual Theme & Atmosphere

**Style**: 暗色克制 · Dark Restrained Premium
**Keywords**: 精密、克制、暗色原生、毛玻璃、微弱边框、留白呼吸、亮度层级、无装饰即是装饰
**Tone**: 像控制面板那样冷静精准 — NOT 花哨、NOT 拥挤、NOT 彩色缤纷
**Feel**: 深空站里一块打磨过的金属表面，信息以星光的方式出现

**Interaction Tier**: L2 流畅交互
**Dependencies**: CSS only + IntersectionObserver（无需 GSAP/Lenis）

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds */
  --bg: #09090b;
  --surface: rgba(255,255,255,0.03);
  --surface-alt: rgba(255,255,255,0.05);
  --surface-hover: rgba(255,255,255,0.07);

  /* Borders */
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);

  /* Text */
  --text: #f4f4f6;
  --text-secondary: #a1a1aa;
  --text-tertiary: #71717a;

  /* Accent — 延续你的紫色，降饱和以匹配克制调性 */
  --accent: #6c5ce7;
  --accent-hover: #7c6ff7;
  --accent-soft: rgba(108, 92, 231, 0.12);

  /* RGB variants for rgba() */
  --bg-rgb: 9, 9, 11;
  --accent-rgb: 108, 92, 231;

  /* Semantic */
  --success: #22c55e;
  --error: #ef4444;
  --warning: #f59e0b;

  /* Radius */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;

  /* Shadows — 暗色底下用极轻层叠 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.6);
}
```

**Color Rules:**
- 所有颜色通过 CSS 变量引用，禁止硬编码 hex
- 同一层级最多用一个强调色
- 信息层级用 white opacity 变化来表达，不用换颜色
- 强调色仅在交互元素（CTA/链接/hover）出现

## 3. Typography Rules

**Font Stack:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
```

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Hero H1 | Inter | 28px | 600 | 1.2 | -0.02em |
| Section H2 | Inter | 20px | 600 | 1.3 | -0.01em |
| H3 / Card Title | Inter | 16px | 600 | 1.4 | normal |
| Body | Inter / Noto Sans SC | 15px | 400 | 1.6 | 0.02em |
| Body 中文 | Noto Sans SC | 15px | 400 | 1.7 | 0.02em |
| Label / Caption | Inter | 12px | 500 | 1.4 | 0.04em |
| Code / Time | 'SF Mono', 'Fira Code', monospace | 11px | 400 | 1.5 | normal |

**Typography Rules:**
- 中文内容用 Noto Sans SC，英文/数字用 Inter
- font-family 中文字族在前，Inter 作为英文 fallback
- 正文行高 ≥ 1.6，中文行高 ≥ 1.7
- 移动端正文字号 ≥ 15px
- 大标题用负 letter-spacing (`-0.02em`)，正文正常

## 4. Component Stylings

### Buttons

**Primary Button**
```css
.btn-primary {
  background: var(--accent);
  color: #fff;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  border: none; cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover { background: var(--accent-hover); box-shadow: 0 0 0 4px var(--accent-soft); }
.btn-primary:active { transform: scale(0.97); }
.btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

**Ghost Button**
```css
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s;
}
.btn-ghost:hover { background: var(--surface-hover); color: var(--text); border-color: var(--border-hover); }
.btn-ghost:active { transform: scale(0.97); }
```

### Cards / Drawer

**Drawer Panel**
```css
.todo-drawer {
  background: rgba(15, 15, 18, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}
```

**Music Player Card**
```css
.search-player {
  background: var(--surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}
```

### Input
```css
input[type="text"] {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: 10px 14px; font-size: 14px;
  transition: all 0.2s;
}
input[type="text"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  outline: none;
}
input[type="text"]::placeholder { color: var(--text-tertiary); }
```

### Todo Item
```css
.todo-item {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: all 0.15s;
}
.todo-item:hover { background: var(--surface-hover); border-color: var(--border); }
.todo-item.completed .todo-text { text-decoration: line-through; color: var(--text-tertiary); }
```

### Scrollbar
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
```

## 5. Layout Principles

- **间距梯度**: 4 / 8 / 12 / 16 / 24 / 32 / 48px
- **Drawer 宽度**: 420px（桌面）/ 100%（移动端）
- **抽屉 padding**: 24px（水平）/ 20px（垂直）
- **Music player 区域**: max-width 520px，居中
- **Section 间距**: 最少 16px 分隔
- **容器无硬 max-width**：功能型工具不设传统 landing 的 1200px 约束

## 6. Depth & Elevation

暗色背景下放弃传统阴影，用边框 + 亮度区分层级：
- **Base** `--bg`：最底层
- **Surface** `var(--surface)`：卡片/面板
- **Elevated** `var(--surface-alt)` + `border`：hover 态、弹出层
- **Overlay** `rgba(0,0,0,0.6)`：遮罩

## 7. Animation & Interaction

**动效档位: L2 流畅交互**
依赖: CSS only + IntersectionObserver，无第三方动画库。

### 入场动画
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.app { animation: fadeInUp 0.4s ease; }
```

### 滚动 Reveal
```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```
```css
.reveal { opacity: 0; transform: translateY(16px); transition: all 0.5s ease; }
.reveal.revealed { opacity: 1; transform: translateY(0); }
```

### Hover 微交互
- 按钮: `scale(0.97)` on active, 背景/边框色过渡 0.2s
- 卡片: `border-color` 从 transparent → `var(--border)` + 背景色过渡
- Todo item: 删除按钮 opacity 0→1，slide 过渡

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 8. Do's and Don'ts

**Do's:**
1. 所有颜色用 CSS 变量
2. 信息层级用 white opacity（文字、边框），不用多色
3. 保持充足留白，间距按 4px 梯度
4. 按钮/输入框都有 focus-visible 样式
5. 中英文混排时中文用 Noto Sans SC，英文用 Inter
6. 毛玻璃效果只在 drawer 和 player card 使用
7. 暗色底上的"发光"效果用 box-shadow rgba(accent, 0.12)

**Don'ts:**
1. 禁止纯白 `#ffffff` — 用 `#f4f4f6` 代替
2. 禁止硬编码颜色值 — 全部走变量
3. 禁止超过两种强调色同时出现
4. 禁止彩色渐变做大背景
5. 禁止 2px 以上粗边框
6. 禁止字体大小跨度超过 3 倍（最大 28px，最小 11px）
7. 禁止在移动元素上使用 `filter: blur()`
8. 禁止纯色块占位图
9. 禁止 Emoji 做主要图标（Playful 场景外）
10. 禁止 `overflow-x: hidden` 直接砍内容 — 用 `overflow: clip` 代替

## 9. Responsive Behavior

| 断点 | 宽度 | 布局变化 |
|------|------|---------|
| Mobile | ≤ 600px | Drawer 全屏，player 全宽，间距收缩 |
| Tablet | 601–900px | Drawer 380px，保持侧栏 |
| Desktop | > 900px | 完整布局，Drawer 420px |

**移动端规则:**
- 触摸目标 ≥ 44×44px
- 无横向溢出
- 输入框 16px 字号（防止 iOS 缩放）
- Drawer 圆角在移动端消失（全屏模式）
