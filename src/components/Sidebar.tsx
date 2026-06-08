import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Download,
  FileText,
  Filter,
  History,
  Library,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Wand2,
} from "lucide-react";

import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import type { AppRoute } from "@/router";
import { useSidebarStore } from "@/store/sidebarStore";

const navItems: Array<{
  to: AppRoute;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = [
  { to: "/", icon: Download, label: "下载" },
  { to: "/tasks", icon: ListTodo, label: "任务管理" },
  { to: "/rules", icon: Wand2, label: "规则管理" },
  { to: "/settings", icon: Settings, label: "通用设置" },
  { to: "/filter", icon: Filter, label: "过滤中心" },
  { to: "/bookshelf", icon: Library, label: "本地书架" },
  { to: "/history", icon: History, label: "下载历史" },
  { to: "/health", icon: Activity, label: "站点健康" },
  { to: "/converter", icon: FileText, label: "文本转换" },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const location = useLocation();
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);

  return (
    <aside
      className="flex h-screen shrink-0 flex-col border-r"
      style={{
        width: collapsed ? 56 : 176,
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* ── Logo / brand ──────────────────────────────────────────── */}
      <div
        className="flex h-14 shrink-0 items-center border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        {collapsed ? (
          /* 折叠态：Logo 居中，点击展开 */
          <button
            onClick={toggle}
            title="展开侧边栏"
            className="group flex h-full w-full items-center justify-center transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
              }}
            >
              <BookOpen className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </div>
          </button>
        ) : (
          /* 展开态：Logo + 文字 + 折叠按钮 */
          <div className="flex w-full items-center justify-between px-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "var(--color-accent-muted)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
                }}
              >
                <BookOpen className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm leading-none font-bold tracking-tight"
                  style={{ color: "var(--color-text)" }}
                >
                  txtx
                </div>
                <div
                  className="mt-0.5 text-[10px] leading-none font-medium"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  小说下载
                </div>
              </div>
            </div>
            <button
              onClick={toggle}
              title="折叠侧边栏"
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
              style={{ color: "var(--color-text-subtle)" }}
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-2.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={collapsed ? label : undefined}
              className="relative flex items-center rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
              style={{
                height: 36,
                padding: collapsed ? "0 10px" : "0 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                background: isActive
                  ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                  : hoveredRoute === to
                    ? "var(--color-surface-2)"
                    : "transparent",
                color: isActive
                  ? "var(--color-accent)"
                  : hoveredRoute === to
                    ? "var(--color-text)"
                    : "var(--color-text-muted)",
                fontWeight: isActive ? 600 : 400,
                boxShadow: isActive
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 18%, transparent)"
                  : "none",
              }}
              onMouseEnter={() => {
                if (!isActive) setHoveredRoute(to);
              }}
              onMouseLeave={() => setHoveredRoute(null)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate text-xs font-medium">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom: theme + expand hint ───────────────────────────── */}
      <div
        className="flex flex-col gap-2 border-t px-2 pt-2 pb-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        {collapsed ? (
          /* 折叠态：只显示主题按钮 */
          <div className="flex justify-center">
            <ThemeSwitcher />
          </div>
        ) : (
          /* 展开态：主题 + 命令面板快捷键 */
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
                )
              }
              className="flex h-7 flex-1 items-center justify-center rounded-lg border font-mono text-xs transition-colors hover:opacity-80"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
              title="命令面板 (Ctrl+K)"
            >
              ⌘K
            </button>
          </div>
        )}

        {/* 折叠时，底部加个展开按钮提示 */}
        {collapsed && (
          <button
            onClick={toggle}
            title="展开侧边栏"
            className="flex h-7 w-full items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-text-subtle)" }}
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
