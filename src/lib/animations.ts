/**
 * Anime.js v4 动画工具模块
 * 封装下载页面常用动画
 */
import { animate, stagger } from "animejs";

// ─── 缓动曲线 ─────────────────────────────────────────────────────────────────

// 标准出缓动（expo — 自信、果断）
const EASE_OUT = "outExpo";
// 快速出缓动（cubic — 轻快反馈）
const EASE_OUT_FAST = "outCubic";

// ─── 数字滚动动画 ─────────────────────────────────────────────────────────────

/**
 * 数字从 from 滚动到 to，更新 element 的 textContent
 */
export function animateCountUp(el: HTMLElement, from: number, to: number, duration = 800): void {
  const obj = { value: from };
  animate(obj, {
    value: to,
    duration,
    ease: EASE_OUT,
    onUpdate: () => {
      el.textContent = String(Math.round(obj.value));
    },
  });
}

// ─── 卡片进入动画 ─────────────────────────────────────────────────────────────

/**
 * 单个元素从右侧滑入
 */
export function animateEnter(el: HTMLElement, delay = 0): void {
  animate(el, {
    translateX: [24, 0],
    opacity: [0, 1],
    duration: 400,
    delay,
    ease: EASE_OUT_FAST,
  });
}

/**
 * 单个元素从下方淡入
 */
export function animateFadeInUp(el: HTMLElement, delay = 0): void {
  animate(el, {
    translateY: [16, 0],
    opacity: [0, 1],
    duration: 350,
    delay,
    ease: EASE_OUT_FAST,
  });
}

/**
 * 面板内容淡入（用于 detail panel 切换）
 */
export function animateFadeIn(el: HTMLElement, delay = 0): void {
  animate(el, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 200,
    delay,
    ease: EASE_OUT_FAST,
  });
}

// ─── 列表错开进入动画 ─────────────────────────────────────────────────────────

/**
 * 多个元素错开进入（stagger）
 */
export function animateStagger(
  els: HTMLElement[] | NodeListOf<HTMLElement>,
  staggerDelay = 60,
): void {
  animate(Array.from(els), {
    translateX: [20, 0],
    opacity: [0, 1],
    duration: 350,
    delay: stagger(staggerDelay),
    ease: EASE_OUT_FAST,
  });
}

// ─── 完成庆祝动画 ─────────────────────────────────────────────────────────────

/**
 * 成功完成时的 pulse + scale 动画
 */
export function animateCelebration(el: HTMLElement): void {
  animate(el, {
    scale: [1, 1.06, 1],
    duration: 600,
    ease: "inOutSine",
  });
}

/**
 * 结果卡片整体进入动画
 */
export function animateResultCard(el: HTMLElement): void {
  animate(el, {
    scale: [0.95, 1],
    opacity: [0, 1],
    duration: 380,
    ease: EASE_OUT,
  });
}

// ─── 步骤指示器动画 ───────────────────────────────────────────────────────────

/**
 * 步骤激活时的弹入动画
 */
export function animateStepActivate(el: HTMLElement): void {
  animate(el, {
    scale: [0.85, 1],
    duration: 280,
    ease: EASE_OUT,
  });
}

// ─── 下拉展开动画 ─────────────────────────────────────────────────────────────

/**
 * 下拉菜单展开动画
 */
export function animateDropdownOpen(el: HTMLElement): void {
  animate(el, {
    translateY: [-8, 0],
    opacity: [0, 1],
    duration: 180,
    ease: EASE_OUT_FAST,
  });
}

/**
 * 模态框 / 命令面板 展开动画
 */
export function animateModalOpen(el: HTMLElement): void {
  animate(el, {
    scale: [0.96, 1],
    opacity: [0, 1],
    duration: 180,
    ease: EASE_OUT,
  });
}
