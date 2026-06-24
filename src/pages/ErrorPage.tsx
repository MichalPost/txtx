import { useState } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0, 0, 1] as const } },
};

const stackVariants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.22, ease: [0.25, 0, 0, 1] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  },
};

function parseError(error: unknown): { title: string; detail: string; stack?: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText || "请求失败"}`,
      detail: typeof error.data === "string" ? error.data : "路由响应出现了问题。",
    };
  }

  if (error instanceof Error) {
    return {
      title: error.name || "运行时错误",
      detail: error.message || "发生了一个未知错误。",
      stack: error.stack,
    };
  }

  return {
    title: "未知错误",
    detail: String(error) || "应用发生了异常，暂时无法继续运行。",
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures and keep the page usable.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
      style={{
        background: copied
          ? "color-mix(in srgb, var(--color-success, #3a7d55) 12%, transparent)"
          : "var(--color-surface-2)",
        color: copied ? "var(--color-success, #3a7d55)" : "var(--color-text-muted)",
        border: `1px solid ${
          copied
            ? "color-mix(in srgb, var(--color-success, #3a7d55) 25%, transparent)"
            : "var(--color-border)"
        }`,
      }}
      title="复制错误信息"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <Check className="h-3 w-3" />
            已复制
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            复制
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

interface ErrorPageProps {
  error?: unknown;
}

export function ErrorPage({ error: propError }: ErrorPageProps = {}) {
  const routeError = useRouteError();
  const navigate = useNavigate();
  const [showStack, setShowStack] = useState(false);

  const { title, detail, stack } = parseError(propError ?? routeError);
  const copyText = stack ? `${detail}\n\n${stack}` : detail;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center px-4 select-none"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--color-danger, #c0392b)", opacity: 0.07 }}
        />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.025]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <defs>
            <pattern
              id="err-grid"
              x="0"
              y="0"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#err-grid)" />
        </svg>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex w-full flex-col gap-5"
        style={{ maxWidth: 480 }}
      >
        <motion.div variants={itemVariants} className="flex items-start gap-4">
          <motion.div
            initial={{ rotate: -10, scale: 0.7, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "color-mix(in srgb, var(--color-danger, #c0392b) 12%, transparent)",
              border:
                "1.5px solid color-mix(in srgb, var(--color-danger, #c0392b) 28%, transparent)",
            }}
          >
            <AlertTriangle
              className="h-6 w-6"
              style={{ color: "var(--color-danger, #c0392b)" }}
              strokeWidth={1.8}
            />
          </motion.div>
          <div className="min-w-0">
            <div
              className="mb-1 font-mono text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--color-danger, #c0392b)", opacity: 0.8 }}
            >
              Application Error
            </div>
            <h1
              className="truncate text-xl leading-snug font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {title}
            </h1>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="font-mono text-xs font-semibold tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Error Message
            </span>
            <CopyButton text={copyText} />
          </div>
          <p
            className="px-4 py-3.5 text-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {detail}
          </p>
        </motion.div>

        {stack && (
          <motion.div
            variants={itemVariants}
            className="overflow-hidden rounded-xl"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 font-mono text-xs transition-colors hover:bg-[var(--color-surface-2)]"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => setShowStack((v) => !v)}
            >
              <span className="font-semibold tracking-wide">Stack Trace</span>
              <motion.span
                animate={{ rotate: showStack ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {showStack && (
                <motion.div
                  key="stack"
                  variants={stackVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{ overflow: "hidden" }}
                >
                  <pre
                    className="overflow-x-auto px-4 pt-0 pb-4 text-[11px] leading-relaxed"
                    style={{
                      color: "var(--color-text-muted)",
                      borderTop: "1px solid var(--color-border)",
                      maxHeight: 200,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {stack}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            返回上一页
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </Button>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center text-xs"
          style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
        >
          如果问题持续出现，请尝试重启应用或检查相关配置。
        </motion.p>
      </motion.div>
    </div>
  );
}
