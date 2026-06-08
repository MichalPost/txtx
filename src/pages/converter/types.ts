import { Languages, Merge, RefreshCw, Scissors } from "lucide-react";

export type ToolMode = "t2s" | "merge" | "split" | "encoding";

export interface ConvertResult {
  path: string;
  message: string;
  ok: boolean;
}

export const TABS: {
  id: ToolMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "t2s", label: "繁→简转换", icon: Languages },
  { id: "merge", label: "合并文件", icon: Merge },
  { id: "split", label: "按章分割", icon: Scissors },
  { id: "encoding", label: "编码转换", icon: RefreshCw },
];
