/**
 * CommandPalette — Cmd+K 全局命令面板
 * 使用 cmdk 库，支持页面跳转、快速操作、历史搜索
 */
import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  Download, Globe, Settings, Shield, History, Activity, FileText,
  ScanSearch, Square, RotateCcw, FolderOpen,
} from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { apiOpenOutputDir } from "@/lib/api";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { phase, startScan, stopDownload, reset } = useDownloadStore();
  const isRunning = phase === "scanning" || phase === "downloading";

  // Open on Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const run = useCallback((action: () => void) => {
    action();
    setOpen(false);
  }, []);

  const navItems: CommandItem[] = [
    { id: "nav-download", label: "下载控制台", group: "页面", icon: <Download className="w-4 h-4" />, action: () => navigate("/"), keywords: ["下载", "download"] },
    { id: "nav-websites", label: "网站配置", group: "页面", icon: <Globe className="w-4 h-4" />, action: () => navigate("/websites"), keywords: ["网站", "站点", "xpath"] },
    { id: "nav-settings", label: "通用设置", group: "页面", icon: <Settings className="w-4 h-4" />, action: () => navigate("/settings"), keywords: ["设置", "配置", "settings"] },
    { id: "nav-blacklist", label: "黑名单管理", group: "页面", icon: <Shield className="w-4 h-4" />, action: () => navigate("/blacklist"), keywords: ["黑名单", "关键词", "过滤"] },
    { id: "nav-history", label: "下载历史", group: "页面", icon: <History className="w-4 h-4" />, action: () => navigate("/history"), keywords: ["历史", "history"] },
    { id: "nav-health", label: "站点健康检测", group: "页面", icon: <Activity className="w-4 h-4" />, action: () => navigate("/health"), keywords: ["健康", "可达", "延迟"] },
    { id: "nav-converter", label: "文本转换", group: "页面", icon: <FileText className="w-4 h-4" />, action: () => navigate("/converter"), keywords: ["转换", "繁简", "converter"] },
  ];

  const actionItems: CommandItem[] = [
    {
      id: "action-scan",
      label: "开始扫描",
      group: "操作",
      icon: <ScanSearch className="w-4 h-4" />,
      action: () => { navigate("/"); reset(); startScan(); },
      keywords: ["扫描", "scan", "开始"],
    },
    ...(isRunning ? [{
      id: "action-stop",
      label: "停止下载",
      group: "操作",
      icon: <Square className="w-4 h-4" />,
      action: () => { navigate("/"); stopDownload(); },
      keywords: ["停止", "stop"],
    }] : []),
    {
      id: "action-reset",
      label: "重置下载状态",
      group: "操作",
      icon: <RotateCcw className="w-4 h-4" />,
      action: () => { navigate("/"); reset(); },
      keywords: ["重置", "reset", "清除"],
    },
    {
      id: "action-open-dir",
      label: "打开下载目录",
      group: "操作",
      icon: <FolderOpen className="w-4 h-4" />,
      action: () => apiOpenOutputDir().catch(() => {}),
      keywords: ["目录", "文件夹", "打开"],
    },
  ];

  const allItems = [...navItems, ...actionItems];
  const groups = ["页面", "操作"];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={e => e.stopPropagation()}
      >
        <Command className="w-full" style={{ background: "transparent" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: "var(--color-border)" }}>
            <span style={{ color: "var(--color-text-subtle)" }}>⌘</span>
            <Command.Input
              placeholder="搜索页面或操作..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--color-text)" }}
            />
            <kbd className="text-xs px-2 py-0.5 rounded border"
              style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm"
              style={{ color: "var(--color-text-muted)" }}>
              没有匹配的命令
            </Command.Empty>
            {groups.map(group => {
              const items = allItems.filter(i => i.group === group);
              return (
                <Command.Group key={group} heading={group}
                  className="mb-1"
                  style={{ "--cmdk-group-heading-color": "var(--color-text-muted)" } as React.CSSProperties}>
                  <style>{`
                    [cmdk-group-heading] {
                      font-size: 11px; font-weight: 600; padding: 6px 8px 4px;
                      color: var(--color-text-muted); text-transform: uppercase;
                      letter-spacing: 0.05em;
                    }
                    [cmdk-item] {
                      display: flex; align-items: center; gap: 10px;
                      padding: 8px 10px; border-radius: 8px; cursor: pointer;
                      font-size: 13px; color: var(--color-text);
                      transition: background 0.1s;
                    }
                    [cmdk-item][aria-selected="true"],
                    [cmdk-item]:hover {
                      background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-2));
                    }
                  `}</style>
                  {items.map(item => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                      onSelect={() => run(item.action)}
                    >
                      <span style={{ color: "var(--color-text-muted)" }}>{item.icon}</span>
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="flex items-center gap-4 px-4 py-2.5 border-t text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}>
            <span>↑↓ 导航</span>
            <span>↵ 确认</span>
            <span>ESC 关闭</span>
            <span className="ml-auto">Ctrl+K 打开/关闭</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
