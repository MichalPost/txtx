/**
 * CommandPalette — Cmd+K 全局命令面板
 * 使用 cmdk 库，支持页面跳转、快速操作、历史搜索
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import {
  Activity,
  Download,
  FileText,
  FolderOpen,
  Globe,
  History,
  ListTodo,
  ScanSearch,
  Settings,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import { animateModalOpen } from "@/lib/animations";
import { apiOpenOutputDir } from "@/lib/api";
import { useAppNavigate } from "@/router";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";

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
  const navigate = useAppNavigate();
  const { createScanTask, setActive, tasks, activeTaskId, cancelTask } = useTaskStore();
  const isRunning = tasks.some(
    (task) => task.status === "scanning" || task.status === "downloading",
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Open on Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Animate on open
  useEffect(() => {
    if (open && panelRef.current) {
      animateModalOpen(panelRef.current);
    }
  }, [open]);

  const run = useCallback((action: () => void) => {
    action();
    setOpen(false);
  }, []);

  const navItems: CommandItem[] = [
    {
      id: "nav-download",
      label: "下载控制台",
      group: "页面",
      icon: <Download className="h-4 w-4" />,
      action: () => navigate("/"),
      keywords: ["下载", "download"],
    },
    {
      id: "nav-tasks",
      label: "任务管理",
      group: "页面",
      icon: <ListTodo className="h-4 w-4" />,
      action: () => navigate("/tasks"),
      keywords: ["任务", "tasks", "下载队列"],
    },
    {
      id: "nav-rules",
      label: "规则管理",
      group: "页面",
      icon: <Globe className="h-4 w-4" />,
      action: () => navigate("/rules"),
      keywords: ["网站", "站点", "xpath", "规则"],
    },
    {
      id: "nav-settings",
      label: "通用设置",
      group: "页面",
      icon: <Settings className="h-4 w-4" />,
      action: () => navigate("/settings"),
      keywords: ["设置", "配置", "settings"],
    },
    {
      id: "nav-filter",
      label: "过滤中心",
      group: "页面",
      icon: <Shield className="h-4 w-4" />,
      action: () => navigate("/filter"),
      keywords: ["黑名单", "关键词", "过滤", "广告", "内容清洗", "filter"],
    },
    {
      id: "nav-history",
      label: "下载历史",
      group: "页面",
      icon: <History className="h-4 w-4" />,
      action: () => navigate("/history"),
      keywords: ["历史", "history"],
    },
    {
      id: "nav-health",
      label: "站点健康检测",
      group: "页面",
      icon: <Activity className="h-4 w-4" />,
      action: () => navigate("/health"),
      keywords: ["健康", "可达", "延迟"],
    },
    {
      id: "nav-converter",
      label: "文本转换",
      group: "页面",
      icon: <FileText className="h-4 w-4" />,
      action: () => navigate("/converter"),
      keywords: ["转换", "繁简", "converter"],
    },
  ];

  const actionItems: CommandItem[] = [
    {
      id: "action-scan",
      label: "新建扫描任务",
      group: "操作",
      icon: <ScanSearch className="h-4 w-4" />,
      action: () => {
        const opts = useDownloadStore.getState().scanOptions;
        void createScanTask(Object.keys(opts).length > 0 ? opts : undefined).then((taskId) => {
          setActive(taskId);
          navigate("/tasks");
          toast.success("已创建扫描任务");
        });
      },
      keywords: ["扫描", "scan", "开始", "任务"],
    },
    ...(isRunning
      ? [
          {
            id: "action-open-running",
            label: "查看运行中的任务",
            group: "操作",
            icon: <ListTodo className="h-4 w-4" />,
            action: () => {
              navigate("/tasks");
            },
            keywords: ["运行中", "任务", "下载中", "扫描中"],
          },
        ]
      : []),
    ...(activeTaskId
      ? [
          {
            id: "action-cancel-active-task",
            label: "取消当前选中任务",
            group: "操作",
            icon: <ListTodo className="h-4 w-4" />,
            action: () => {
              void cancelTask(activeTaskId);
              navigate("/tasks");
              toast.success("已取消当前任务");
            },
            keywords: ["取消", "任务", "停止"],
          },
        ]
      : []),
    {
      id: "action-open-dir",
      label: "打开下载目录",
      group: "操作",
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => apiOpenOutputDir().catch(() => {}),
      keywords: ["目录", "文件夹", "打开"],
    },
  ];

  const allItems = [...navItems, ...actionItems];
  const groups = ["页面", "操作"];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center pt-[15vh]"
      style={{
        background: "rgba(0,0,0,0.45)",
        animation: "fadeIn 150ms ease forwards",
      }}
      onClick={() => setOpen(false)}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div
        ref={panelRef}
        className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full" style={{ background: "transparent" }}>
          <div
            className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span style={{ color: "var(--color-text-subtle)" }}>⌘</span>
            <Command.Input
              placeholder="搜索页面或操作..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-text)" }}
            />
            <kbd
              className="rounded border px-2 py-0.5 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty
              className="py-8 text-center text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              没有匹配的命令
            </Command.Empty>
            {groups.map((group) => {
              const items = allItems.filter((i) => i.group === group);
              return (
                <Command.Group
                  key={group}
                  heading={group}
                  className="mb-1"
                  style={
                    {
                      "--cmdk-group-heading-color": "var(--color-text-muted)",
                    } as React.CSSProperties
                  }
                >
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
                  {items.map((item) => (
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
          <div
            className="flex items-center gap-4 border-t px-4 py-2.5 text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
          >
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
