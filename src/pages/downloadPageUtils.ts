import type { AppConfig, TaskRecord } from "@/types";

interface DownloadOverviewStat {
  label: string;
  value: string;
  tone: "default" | "accent" | "warning" | "danger";
}

interface DownloadOverview {
  stats: DownloadOverviewStat[];
  primaryMessage: string;
  secondaryMessage: string;
  ctaLabel: string;
}

export function buildDownloadOverview(args: {
  tasks: TaskRecord[];
  config: AppConfig | null;
  configError: string | null;
}): DownloadOverview {
  const activeCount = args.tasks.filter(
    (task) => task.status === "scanning" || task.status === "downloading",
  ).length;
  const pendingCount = args.tasks.filter(
    (task) => task.status === "preview" || task.status === "queued" || task.status === "paused",
  ).length;
  const failedCount = args.tasks.filter((task) => task.status === "failed").length;
  const doneCount = args.tasks.filter((task) => task.status === "done").length;
  const siteCount = args.config ? Object.keys(args.config.websites).length : 0;

  const stats: DownloadOverviewStat[] = [
    {
      label: "可用站点",
      value: args.configError ? "异常" : String(siteCount),
      tone: args.configError ? "danger" : "default",
    },
    { label: "进行中", value: String(activeCount), tone: activeCount > 0 ? "accent" : "default" },
    { label: "待处理", value: String(pendingCount), tone: pendingCount > 0 ? "warning" : "default" },
    { label: "失败任务", value: String(failedCount), tone: failedCount > 0 ? "danger" : "default" },
  ];

  if (args.configError) {
    return {
      stats,
      primaryMessage: "当前无法安全发起新任务，请先恢复站点配置。",
      secondaryMessage: "建议先检查规则配置、后端服务和本地配置文件，再重新加载。",
      ctaLabel: "检查规则配置",
    };
  }

  if (siteCount === 0) {
    return {
      stats,
      primaryMessage: "还没有可用站点规则，先补一条规则再开始下载。",
      secondaryMessage: "建议先去规则管理导入或新建站点，完成后就能直接发起扫描和单本下载。",
      ctaLabel: "配置站点规则",
    };
  }

  if (activeCount > 0 || pendingCount > 0) {
    return {
      stats,
      primaryMessage: `当前有 ${activeCount} 个任务正在运行，${pendingCount} 个任务等待你确认或继续。`,
      secondaryMessage: `最近累计完成 ${doneCount} 个任务；可随时跳转到任务管理查看日志与结果。`,
      ctaLabel: "前往任务管理",
    };
  }

  return {
    stats,
    primaryMessage: "主流程已经就绪，可以直接发起扫描、批量导入或单本下载。",
    secondaryMessage: `当前已配置 ${siteCount} 个站点，最近累计完成 ${doneCount} 个任务。`,
    ctaLabel: "开始新任务",
  };
}
