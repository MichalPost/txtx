import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { CommandPalette } from "@/components/CommandPalette";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import { Sidebar } from "@/components/Sidebar";
import { apiCheckFirstRun } from "@/lib/api";
import { useAiStore } from "@/store/aiStore";
import { useConfigStore } from "@/store/configStore";
import { runScheduledBatchTask } from "@/store/schedulerRunner";
import { useSchedulerStore } from "@/store/schedulerStore";
import { useTaskStore } from "@/store/taskStore";
import { toast } from "sonner";

// 页面切换动画变体：轻微向上淡入，向下淡出
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.18,
  ease: [0.4, 0, 0.2, 1] as const, // material ease-in-out
};

export function RootLayout() {
  const location = useLocation();
  const { error, loadConfig } = useConfigStore();
  const { loaded: aiLoaded, load: loadAi } = useAiStore();
  const [firstRun, setFirstRun] = useState<boolean | null>(null); // null = checking

  // 检测首次运行
  useEffect(() => {
    apiCheckFirstRun()
      .then((isFirst) => {
        setFirstRun(isFirst);
        if (!isFirst) loadConfig();
      })
      .catch(() => {
        setFirstRun(false);
        loadConfig();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 全局加载 AI 配置（与页面无关，启动时就加载）
  useEffect(() => {
    if (!aiLoaded) loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 向导完成后加载配置
  const handleSetupComplete = () => {
    setFirstRun(false);
    loadConfig();
  };

  // 路由跳转状态 — 用于顶部进度条
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";

  // 每日自动扫描调度器
  const {
    enabled: schedEnabled,
    hour: schedHour,
    lastRun: schedLastRun,
    markRan: schedMarkRan,
  } = useSchedulerStore();
  const createBatchTask = useTaskStore((s) => s.createBatchTask);

  // Keep refs up-to-date so the interval closure always reads the latest values
  // without needing to be recreated every time they change.
  const schedRef = useRef({ schedHour, schedLastRun, schedMarkRan, createBatchTask });
  useEffect(() => {
    schedRef.current = { schedHour, schedLastRun, schedMarkRan, createBatchTask };
  });

  useEffect(() => {
    if (!schedEnabled) return;

    const check = () => {
      const {
        schedHour: hour,
        schedLastRun: lastRun,
        schedMarkRan: markRan,
        createBatchTask: createTask,
      } = schedRef.current;
      void runScheduledBatchTask({
        now: new Date(),
        targetHour: hour,
        lastRun,
        createTask,
        markRan,
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`定时任务创建失败：${message}`);
        },
      });
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [schedEnabled, schedHour]); // only re-run when enabled state or target hour changes

  // 首次运行：全屏向导（不渲染 Sidebar/主内容）
  if (firstRun === true) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      <Sidebar />
      <main className="relative flex h-full flex-1 flex-col overflow-hidden">
        {error && (
          <div
            className="m-4 rounded-lg border px-4 py-3 text-sm"
            style={{
              background: "var(--color-danger-bg)",
              borderColor: "var(--color-danger)",
              color: "var(--color-danger)",
            }}
          >
            配置加载失败：{error}
          </div>
        )}

        {/* 顶部进度条（framer-motion 版，loader 期间显示） */}
        <AnimatePresence>
          {isNavigating && (
            <motion.div
              key="nav-bar"
              className="absolute top-0 right-0 left-0 z-10 h-0.5"
              style={{ background: "var(--color-accent)", originX: 0 }}
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 0.85, opacity: 1 }}
              exit={{ scaleX: 1, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* 页面切换动画：以 pathname 为 key，切换时触发 exit → enter */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="h-full w-full overflow-hidden"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandPalette />
    </div>
  );
}
