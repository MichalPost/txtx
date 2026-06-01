# 前端技能文档

本文档汇总当前可用的前端相关技能，包括激活方式和核心功能说明。

---

## 技能总览

| 技能 | 激活命令 | 定位 |
|---|---|---|
| **impeccable** | `$impeccable [command]` | 生产级界面设计与迭代，含完整命令体系 |
| **frontend-design** | 提及前端界面设计任务时调用 | 独特、生产级界面，强调大胆美学方向 |
| **frontend-skill** | 提及落地页、网站、原型时调用 | 视觉主导页面，强调构图、图像层级与动效 |
| **ui-ux-pro-max** | 提及 UI/UX、设计系统时调用 | 设计系统、组件规范、可访问性全方位覆盖 |
| **ui-skills** | 提及界面构建任务时调用 | 有主见的界面构建约束与规范引导 |

---

## 1. impeccable

最完整的前端设计技能，提供从设计到生产的全流程命令体系。

**激活方式**：在对话中输入 `$impeccable` 或 `$impeccable [command]`

### 上下文初始化

首次使用前需加载项目上下文（PRODUCT.md + DESIGN.md）：

```bash
node .agents/skills/impeccable/scripts/load-context.mjs
```

实时迭代模式已内置上下文加载，无需额外运行上述命令：

```bash
node .agents/skills/impeccable/scripts/live.mjs
```

创建或移除命令快捷方式：

```bash
node .agents/skills/impeccable/scripts/pin.mjs pin <command>
node .agents/skills/impeccable/scripts/pin.mjs unpin <command>
```

### 命令列表

#### Build — 构建

| 命令 | 说明 |
|---|---|
| `$impeccable craft [feature]` | 端到端设计并构建功能（先塑形，再编码） |
| `$impeccable shape [feature]` | 编码前规划 UX/UI 方案 |
| `$impeccable teach` | 初始化 PRODUCT.md 和 DESIGN.md |
| `$impeccable document` | 从现有代码生成 DESIGN.md |
| `$impeccable extract [target]` | 将可复用 token 和组件提取到设计系统 |

#### Evaluate — 评估

| 命令 | 说明 |
|---|---|
| `$impeccable critique [target]` | UX 设计审查，含启发式评分 |
| `$impeccable audit [target]` | 技术质量检查（可访问性、性能、响应式） |

#### Refine — 精炼

| 命令 | 说明 |
|---|---|
| `$impeccable polish [target]` | 上线前最终质量打磨 |
| `$impeccable bolder [target]` | 放大过于保守或平淡的设计 |
| `$impeccable quieter [target]` | 收敛过于激进或视觉过载的设计 |
| `$impeccable distill [target]` | 剥离至本质，去除复杂度 |
| `$impeccable harden [target]` | 生产就绪：错误处理、国际化、边界情况 |
| `$impeccable onboard [target]` | 设计首次运行流程、空状态、激活引导 |

#### Enhance — 增强

| 命令 | 说明 |
|---|---|
| `$impeccable animate [target]` | 添加有目的性的动画和动效 |
| `$impeccable colorize [target]` | 为单色 UI 添加战略性色彩 |
| `$impeccable typeset [target]` | 改善字体层级和字体选择 |
| `$impeccable layout [target]` | 修复间距、节奏和视觉层级 |
| `$impeccable delight [target]` | 添加个性化和令人印象深刻的细节 |
| `$impeccable overdrive [target]` | 突破常规限制，极致发挥 |

#### Fix — 修复

| 命令 | 说明 |
|---|---|
| `$impeccable clarify [target]` | 改善 UX 文案、标签和错误信息 |
| `$impeccable adapt [target]` | 适配不同设备和屏幕尺寸 |
| `$impeccable optimize [target]` | 诊断并修复 UI 性能问题 |

#### Iterate — 迭代

| 命令 | 说明 |
|---|---|
| `$impeccable live` | 可视化变体模式：在浏览器中选取元素，生成替代方案 |

### 设计原则

**颜色**：使用 OKLCH 色彩空间；不使用纯黑 `#000` 或纯白 `#fff`，所有中性色向品牌色调倾斜。

**主题**：深色/浅色不是默认值，需根据使用场景决定。

**排版**：正文行长限制在 65–75ch；层级通过字号和字重对比（相邻层级 ≥1.25 比例）实现。

**布局**：间距要有节奏变化；卡片仅在真正需要时使用；嵌套卡片始终是错误的。

**动效**：不对 CSS 布局属性做动画；使用指数缓出曲线（ease-out-quart/quint/expo）。

### 绝对禁止

- 侧边彩色边框（`border-left/right` > 1px 作为装饰）
- 渐变文字（`background-clip: text` + 渐变背景）
- 默认使用玻璃拟态
- 英雄指标模板（大数字 + 小标签 + 渐变装饰）
- 相同尺寸的卡片网格无限重复
- 第一反应就用 Modal

---

## 2. frontend-design

创建独特、生产级前端界面，强调大胆的美学方向和精湛的实现。

**激活方式**：在对话中提及前端界面设计任务时调用

### 核心工作流

1. **明确目的**：这个界面解决什么问题？谁在使用？
2. **确定基调**：选择一个极端风格方向并坚定执行
3. **差异化**：这个界面有什么令人难忘的特点？

### 风格方向参考

| 风格 | 描述 |
|---|---|
| 极简主义 | 精准的间距、排版和细节 |
| 最大化主义 | 丰富的动画和视觉效果 |
| 复古未来主义 | 科技感与怀旧感结合 |
| 有机/自然 | 柔和曲线、自然色调 |
| 奢华/精致 | 高端材质感、克制的色彩 |
| 编辑/杂志 | 强排版、大图、叙事性布局 |
| 野兽派/原始 | 粗犷字体、高对比、无修饰 |
| 工业/实用 | 功能优先、密集信息 |

### 技术实现要点

- **字体**：选择独特字体，避免 Inter、Arial 等过度使用的通用字体
- **颜色**：使用 CSS 变量保持一致性；主色 + 锐利强调色
- **动效**：CSS 优先；React 项目使用 Motion 库；聚焦高影响时刻
- **构图**：非对称、重叠、对角线流动、打破网格、充足留白

### 禁止使用

- Inter、Roboto、Arial 等过度使用的字体
- 白底紫色渐变等陈词滥调配色
- 可预测的布局和组件模式
- 缺乏上下文特色的通用设计

---

## 3. frontend-skill

视觉主导的落地页、网站、应用原型，强调构图、图像层级、内容结构和动效。

**激活方式**：在对话中提及落地页、网站、应用原型等视觉强需求任务时调用

### 构建前需明确三件事

1. **视觉主题**：一句话描述氛围、材质和能量
2. **内容规划**：英雄区 → 支撑区 → 细节区 → 最终 CTA
3. **交互主题**：2-3 个改变页面感受的动效想法

### 落地页默认结构

| 区块 | 内容 |
|---|---|
| Hero | 品牌/产品 + 承诺 + CTA + 一个主视觉 |
| Support | 一个具体功能、卖点或证明 |
| Detail | 氛围、工作流、产品深度或故事 |
| Final CTA | 转化、开始、访问或联系 |

### Hero 规则

- 只有一个构图
- 全出血图像或主视觉平面
- 品牌优先 → 标题 → 正文 → CTA
- 禁止：Hero 卡片、统计条、Logo 云、浮动 Dashboard

### 视口预算

固定 Header 计入 Hero 视口，使用 `100vh`/`100svh` 时需减去 Header 高度：

```css
height: calc(100svh - var(--header-height));
```

### 图像原则

- 图像必须承担叙事功能
- 优先使用真实感的实景摄影，而非抽象渐变
- 选择有稳定色调区域的图像以便叠加文字
- 不使用内嵌 UI 框架、分割线、卡片的图像

### 动效规范

至少 2-3 个有意图的动效：Hero 入场序列、滚动联动或深度效果、悬停/揭示/布局过渡。

推荐使用 Framer Motion 实现：区块揭示、共享布局过渡、滚动联动的透明度/位移/缩放、吸附叙事、轮播、菜单/抽屉/Modal 出现效果。

---

## 4. ui-ux-pro-max

UI/UX 设计智能，覆盖设计系统、组件规范、可访问性、UX 流程等全方位需求。

**激活方式**：在对话中提及 UI 设计、UX 流程、设计系统等任务时调用

### 工作流程

**第一步：需求确认**

开始前确认以下信息：
- 目标平台：Web / iOS / Android / 桌面端
- 技术栈：React/Next/Vue/Svelte，CSS/Tailwind，组件库
- 目标与约束：转化率、速度、品牌风格、可访问性级别（WCAG AA？）
- 现有资产：截图、Figma、代码仓库、URL、用户旅程

**第二步：交付物类型**

| 交付物 | 内容 |
|---|---|
| UI 概念 + 布局 | 视觉方向、网格、排版、色彩系统、关键页面/区块 |
| UX 流程 | 用户旅程、关键路径、错误/空/加载状态、边界情况 |
| 设计系统 | Token（颜色/排版/间距/圆角/阴影）、组件规则、可访问性说明 |
| 实现方案 | 精确到文件级别的修改、组件拆解、验收标准 |

### 输出标准

- 默认使用 ASCII 字符的 Token/变量名
- 必须包含：间距比例、字号比例、2-3 个字体配对方案、颜色 Token、组件状态
- 必须覆盖：空状态/加载状态/错误状态、键盘导航、焦点状态、对比度

### 应用 UI 设计原则

- 平静的表面层级
- 强排版和间距
- 少量颜色
- 密集但可读的信息
- 最少的装饰性元素
- 卡片仅在卡片本身是交互时使用

---

## 5. ui-skills

有主见的、持续演进的界面构建约束与规范引导。

**激活方式**：在对话中提及界面构建任务时调用

**参考资源**：[ui-skills 源仓库](https://github.com/ibelick/ui-skills)
