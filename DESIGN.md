# DESIGN.md — txtx

源自 `src/styles.css`、现有组件代码和 2026-06 设计迭代，记录当前设计系统的实际状态。

---

## Color Strategy

**Restrained**。底色是有温度的中性色，琥珀 accent 占比不超过 10%。颜色作用是区分层级和引导操作，不用来装饰。

### Themes

4 套主题，通过 `<html data-theme="...">` 切换，默认为 `light`（晨纸米）。

#### light — 晨纸米（默认）

像刚翻开的轻文学读本。米白底、琥珀 accent、暖棕文字。

```
--color-bg:           #faf8f4
--color-surface:      #fffefb
--color-surface-1:    #f8f5ef
--color-surface-2:    #f3f0ea
--color-border:       #e6e0d5
--color-border-hover: #d0c8bb
--color-accent:       #b07235
--color-accent-hover: #9a6228
--color-accent-muted: #f5ede2
--color-success:      #3a7d55
--color-success-bg:   #edf7f2
--color-warning:      #c07a10
--color-warning-bg:   #fef7ea
--color-danger:       #c0392b
--color-danger-bg:    #fef2f2
--color-text:         #2d2419
--color-text-muted:   #7a6d60
--color-text-subtle:  #afa49a
--shadow-sm:   0 1px 3px rgba(45,36,25,0.07), 0 1px 2px rgba(45,36,25,0.04)
--shadow-md:   0 4px 16px rgba(45,36,25,0.09), 0 2px 6px rgba(45,36,25,0.05)
--shadow-lg:   0 8px 28px rgba(45,36,25,0.12), 0 4px 10px rgba(45,36,25,0.07)
--shadow-accent: 0 4px 14px rgba(176,114,53,0.28)
```

#### warm — 暖陶棕

陶土橙 accent，偏黄暖调。适合更喜欢色温偏高的用户。

```
--color-accent: #c2622a  (terracotta)
--color-bg:     #faf6f0
```

#### sage — 薄荷绿

石绿 accent，平静自然。适合长时间使用时减少视觉疲劳。

```
--color-accent: #2d7d5a  (mist green)
--color-bg:     #f4f7f5
```

#### dark — 深墨夜

深海军蓝底色，暖琥珀 accent（不是冷紫蓝）。深夜阅读时使用。

```
--color-accent: #c8925a  (warm amber on dark)
--color-bg:     #0f1117
--color-text:   #e8e0d5
```

### Color Roles

| Token | 用途 |
|---|---|
| `--color-bg` | 页面底层背景 |
| `--color-surface` | 卡片、面板、弹出层 |
| `--color-surface-1` | 表格 header、dropdown 头部、分组区块 |
| `--color-surface-2` | 输入框、hover 背景、次级填充 |
| `--color-border` | 默认边框 |
| `--color-border-hover` | 悬停/聚焦时的边框 |
| `--color-accent` | 主操作按钮、激活态、高亮、链接 |
| `--color-accent-muted` | accent 色的浅背景（标签、chip 背景） |
| `--color-text` | 正文，最高对比度 |
| `--color-text-muted` | 次级文字、标签、辅助信息 |
| `--color-text-subtle` | 占位符、禁用文字、最弱信息 |

---

## Typography

### Font Stack

Windows 优先，中文适配：

```css
font-family:
  "Inter",               /* 英文、数字 */
  "PingFang SC",         /* macOS 中文 */
  "Hiragino Sans GB",
  "Microsoft YaHei UI",  /* Windows 推荐，行高更舒适 */
  "Microsoft YaHei",
  sans-serif;
```

### Base

```css
font-size:   14px
line-height: 1.6        /* 中文需要比英文更大的行高 */
letter-spacing: 0.01em  /* 轻微字间距，增加呼吸感 */
```

### Type Scale

```
--text-xs:   11px   辅助标注、tag、徽章
--text-sm:   12px   表格内容、说明文字
--text-base: 14px   正文（默认）
--text-md:   15px   强调正文
--text-lg:   16px   卡片标题
--text-xl:   18px   页面标题
--text-2xl:  22px   大标题（首屏、空状态）
```

字重：`400` 正文 / `500` 中等强调 / `600` 标题、导航激活 / `700` 仅用于数字、徽章

### Rules

- 相邻层级字号比例 >= 1.25
- 正文行长不超过 72ch
- 不对相邻层级只改字重不改字号（二者都要变）

---

## Spacing

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
```

**节奏规则：** 间距要有变化，不要所有地方都用同一个值。页面内边距 20px，卡片内边距 16px，组件间隔 12–16px，紧凑列表 8px。

---

## Border Radius

```
--radius-sm:   6px    小 chip、tag、输入框内嵌按钮
--radius-md:   10px   按钮、输入框、小卡片
--radius-lg:   14px   卡片、面板主体
--radius-xl:   20px   大弹出层、空状态卡片
--radius-full: 9999px 胶囊按钮、状态圆点
```

---

## Elevation (Shadows)

```
--shadow-sm     卡片默认（细微浮起）
--shadow-md     hover 态卡片、下拉菜单、tooltip
--shadow-lg     Modal、大弹出层
--shadow-accent 主操作按钮（accent 色光晕）
```

不用纯黑阴影，所有阴影向底层颜色倾斜（暖棕、深绿、深墨）。

---

## Components

### Button

4 个变体：`primary` / `secondary` / `danger` / `ghost`

```
primary:
  bg: --color-accent  text: #fff
  shadow: --shadow-accent
  hover: bg --color-accent-hover, translateY(-1px), shadow 增强
  active: scale(0.97)

secondary:
  bg: --color-surface-2  border: 1px --color-border  text: --color-text
  hover: bg --color-border, border --color-border-hover

danger:
  bg: --color-danger  text: #fff
  hover: opacity 0.88, translateY(-1px)

ghost:
  bg: transparent  text: --color-text-muted
  hover: bg --color-surface-2, text --color-text
```

3 个尺寸：`sm` (32px) / `md` (36px) / `lg` (40px)

通用规则：`font-weight: 500` / `border-radius: --radius-md` / icon+label gap 6px / disabled: opacity 0.40

### Card

```
bg: --color-surface
border: 1px --color-border
border-radius: --radius-lg  (14px)
box-shadow: --shadow-sm
padding: 16px (body), 12px 16px (header)

header: border-bottom, font-weight 600, font-size --text-lg
actions: 右对齐，flex gap-2
```

变体：
- `hoverable`: hover 时 border → --color-border-hover, shadow → --shadow-md, translateY(-1px)
- `inset`: bg → --color-surface-2, border: none, shadow: none（用于嵌套区块）

**规则：嵌套卡片禁止。** 卡片内用 `inset` 变体或直接用 border + 背景色区分，不要 card-in-card。

### Input / Textarea

```
bg: --color-surface
border: 1px --color-border
border-radius: --radius-md  (10px)
font-size: 14px
placeholder: --color-text-subtle

focus:
  border: --color-accent
  box-shadow: 0 0 0 3px --color-accent-muted
```

### Sidebar Navigation

```
width: 176px  (w-44)
bg: --color-surface
border-right: 1px --color-border

logo area: 56px 高, padding 16px, 小图标 + 产品名

nav item: 高 36px, padding 0 12px, gap 10px, border-radius --radius-md
  default:  text --color-text-muted, border-left 2px transparent
  hover:    bg --color-surface-2, text --color-text
  active:   bg --color-accent-muted, text --color-accent,
            font-weight 600, border-left 2px --color-accent

bottom: theme switcher + ⌘K button
```

### Status / Badge

```
success:  bg --color-success-bg,  text --color-success
warning:  bg --color-warning-bg,  text --color-warning
danger:   bg --color-danger-bg,   text --color-danger
accent:   bg --color-accent-muted, text --color-accent
subtle:   bg --color-surface-2,   text --color-text-muted

font-size: --text-xs (11px)
border-radius: --radius-full (胶囊) 或 --radius-sm (矩形)
```

### Table

```
thead:
  bg: --color-surface-1
  border-bottom: 1px --color-border
  font-size: --text-xs, font-weight: 600, color: --color-text-muted

tbody row (奇数行):  bg --color-surface
tbody row (偶数行):  bg --color-surface-1
tbody row (hover):   bg --color-surface-2, transition 100ms

cell padding: 12px 12px
border-top: 1px --color-border（行间）
```

---

## Motion

- 主题切换：`transition: background-color, border-color, color, box-shadow 150ms ease`
- 按钮交互：hover 100ms ease，active scale 97ms
- 卡片 hover lift：translateY(-1px) 150ms ease
- 面板入场：fadeInUp，delay 递增（100ms, 200ms...），使用 animejs
- Dropdown 展开：animateDropdownOpen（参见 `src/lib/animations.ts`）
- **不对 CSS 布局属性做动画**（width, height, padding, margin）
- 缓动曲线：ease-out 系列（ease-out-quart 首选）

---

## Patterns

### Empty State

居中布局：accent-muted 背景的大图标（64px, border-radius --radius-xl）+ 标题（--text-xl, 600）+ 说明（--text-base, --color-text-muted）+ 主 CTA 按钮。
图标背景用 `--color-accent-muted`，有 accent 色轻边框和 `--shadow-accent`。

### Page Layout

```
<aside>  w-44 侧边栏
<main>
  <div class="px-5 pt-5">  PageHeader（含底部 border）
  <div class="px-5 mt-3">  工具栏/状态栏
  <div class="px-5 mt-4 pb-5 flex-1">  主内容区
```

### Status Bar（下载页专用）

```
mx-5 mt-3 px-4 py-2 rounded-xl
bg: --color-surface-1  border: 1px --color-border
内容：StepIndicator（左）+ 状态点 + 文字（右）
```

---

## Copy Rules

- 用自然口语，不用系统术语："下载完了"不是"操作成功"
- 标题不重复副标题内容
- 不用感叹号
- 错误信息说明原因，不只报错码
- 空状态有动词：说清楚用户能做什么，不是"暂无数据"
- 不用破折号（—），改用逗号或分号

---

## Anti-Patterns（禁止）

- 侧边彩色宽边框（> 1px 的 border-left/right 装饰）
- 渐变文字（background-clip: text + gradient）
- 默认使用玻璃拟态
- SaaS 英雄指标模板（大数字 + 渐变装饰）
- 相同尺寸卡片无限重复网格
- Modal 作为第一反应
- 嵌套卡片
- 所有间距都一样
- 冷蓝/荧光/纯黑等脱离暖调系统的颜色
