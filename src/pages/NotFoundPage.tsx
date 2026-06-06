import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowLeft, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/Button";

// ─── 动效变体 ─────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.32, ease: [0.25, 0, 0, 1] as const } },
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function NotFoundPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 浮动粒子动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const dots = Array.from({ length: 28 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 2.5 + 0.5,
      dx:    (Math.random() - 0.5) * 0.4,
      dy:    (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.35 + 0.08,
    }));

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent").trim() || "#b07235";

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const d of dots) {
        d.x += d.dx;
        d.y += d.dy;
        if (d.x < 0 || d.x > canvas!.width)  d.dx *= -1;
        if (d.y < 0 || d.y > canvas!.height) d.dy *= -1;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx!.fillStyle    = accent;
        ctx!.globalAlpha  = d.alpha;
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden select-none"
      style={{ background: "var(--color-bg)" }}
    >
      {/* 背景粒子 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 主体卡片 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center gap-6 px-10 py-12 rounded-2xl"
        style={{
          background:  "var(--color-surface)",
          border:      "1px solid var(--color-border)",
          boxShadow:   "0 20px 60px rgba(0,0,0,0.12)",
          maxWidth:    420,
          width:       "calc(100% - 2rem)",
        }}
      >
        {/* 图标 */}
        <motion.div variants={itemVariants} className="relative flex items-center justify-center">
          <div
            className="absolute w-28 h-28 rounded-full blur-2xl opacity-30"
            style={{ background: "var(--color-accent)" }}
          />
          <motion.div
            initial={{ rotate: -15, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0,   scale: 1,   opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "var(--color-accent-muted)",
              border:     "1.5px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
            }}
          >
            <Compass className="w-9 h-9" style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
          </motion.div>
        </motion.div>

        {/* 数字 404 */}
        <motion.div variants={itemVariants} className="text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-8xl font-black tracking-tighter leading-none"
            style={{
              background:             "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 50%, var(--color-text-muted)))",
              WebkitBackgroundClip:   "text",
              WebkitTextFillColor:    "transparent",
              backgroundClip:         "text",
            }}
          >
            404
          </motion.div>
          <div className="mt-3 text-base font-semibold" style={{ color: "var(--color-text)" }}>
            页面迷路了
          </div>
          <div
            className="mt-1.5 text-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            你访问的路径不存在，也许是链接失效了，<br />
            或者页面已经被移走。
          </div>
        </motion.div>

        {/* 按钮 */}
        <motion.div variants={itemVariants} className="flex gap-3 w-full">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-3.5 h-3.5" />
            返回上页
          </Button>
          <Button variant="primary" size="md" className="flex-1" onClick={() => navigate("/")}>
            <BookOpen className="w-3.5 h-3.5" />
            回到首页
          </Button>
        </motion.div>
      </motion.div>

      {/* 底部装饰 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="relative z-10 mt-6 text-xs font-mono"
        style={{ color: "var(--color-text-muted)" }}
      >
        ERROR · 404 · NOT_FOUND
      </motion.div>
    </div>
  );
}
