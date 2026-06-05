import { Outlet, useNavigation, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import { useConfigStore } from "@/store/configStore";
import { useAiStore } from "@/store/aiStore";
import { apiCheckFirstRun } from "@/lib/api";

// 页面切换动画变体：轻微向上淡入，向下淡出
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
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
    apiCheckFirstRun().then(isFirst => {
      setFirstRun(isFirst);
      if (!isFirst) loadConfig();
    }).catch(() => {
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
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div
            className="m-4 px-4 py-3 rounded-lg border text-sm"
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
              className="absolute top-0 left-0 right-0 h-0.5 z-10"
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
            className="h-full w-full"
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
