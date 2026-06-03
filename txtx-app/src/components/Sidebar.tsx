import { NavLink } from "react-router-dom";
import {
  Download, Globe, Settings, Shield, BookOpen,
  History, Activity, FileText, ListTodo,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const navItems = [
  { to: "/",          icon: Download,  label: "下载"     },
  { to: "/tasks",     icon: ListTodo,  label: "任务管理" },
  { to: "/websites",  icon: Globe,     label: "网站配置" },
  { to: "/settings",  icon: Settings,  label: "通用设置" },
  { to: "/blacklist", icon: Shield,    label: "黑名单"   },
  { to: "/history",   icon: History,   label: "下载历史" },
  { to: "/health",    icon: Activity,  label: "站点健康" },
  { to: "/converter", icon: FileText,  label: "文本转换" },
];

export function Sidebar() {
  return (
    <aside
      className="flex flex-col w-44 shrink-0 h-screen border-r"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Logo / brand */}
      <div
        className="flex items-center gap-2.5 h-14 px-4 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "var(--color-accent-muted)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
          }}
        >
          <BookOpen className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
        </div>
        <span
          className="text-sm font-semibold tracking-tight select-none"
          style={{ color: "var(--color-text)" }}
        >
          txtx
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 w-full h-9 px-3 rounded-lg transition-all ${
                isActive ? "nav-active" : "nav-inactive"
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: "var(--color-accent-muted)",
                    color: "var(--color-accent)",
                    fontWeight: 600,
                    borderLeft: "2px solid var(--color-accent)",
                  }
                : {
                    color: "var(--color-text-muted)",
                    borderLeft: "2px solid transparent",
                  }
            }
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.classList.contains("nav-active")) {
                el.style.background = "var(--color-surface-2)";
                el.style.color = "var(--color-text)";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.classList.contains("nav-active")) {
                el.style.background = "";
                el.style.color = "var(--color-text-muted)";
              }
            }}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: theme switcher */}
      <div
        className="flex flex-col gap-2 px-3 pb-4 pt-2 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
              )
            }
            className="flex-1 h-7 rounded-lg text-xs font-mono flex items-center justify-center border transition-colors hover:opacity-80"
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
      </div>
    </aside>
  );
}
