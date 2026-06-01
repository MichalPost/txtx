import { NavLink } from "react-router-dom";
import { Download, Globe, Settings, Shield, BookOpen, History, Activity, FileText } from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const navItems = [
  { to: "/", icon: Download, label: "下载" },
  { to: "/websites", icon: Globe, label: "网站配置" },
  { to: "/settings", icon: Settings, label: "通用设置" },
  { to: "/blacklist", icon: Shield, label: "黑名单" },
  { to: "/history", icon: History, label: "下载历史" },
  { to: "/health", icon: Activity, label: "站点健康" },
  { to: "/converter", icon: FileText, label: "文本转换" },
];

export function Sidebar() {
  return (
    <aside
      className="flex flex-col w-16 shrink-0 h-screen border-r"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center h-14 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <BookOpen className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
      </div>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-1 py-3 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              `group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                isActive ? "nav-active" : "nav-inactive"
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: "var(--color-accent)",
                    color: "#fff",
                    boxShadow: "var(--shadow-accent)",
                  }
                : {
                    color: "var(--color-text-muted)",
                  }
            }
          >
            <Icon className="w-5 h-5" />
            {/* Tooltip */}
            <span
              className="absolute left-14 px-2 py-1 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Theme switcher at bottom */}
      <div
        className="flex items-center justify-center pb-3 pt-2 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
