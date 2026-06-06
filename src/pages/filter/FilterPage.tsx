import { useState } from "react";
import { Shield, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

import { BlacklistTab } from "./BlacklistTab";
import { ContentCleanTab } from "./ContentCleanTab";

type TabId = "blacklist" | "content";

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  {
    id: "blacklist",
    label: "黑名单",
    icon: Shield,
    desc: "过滤不下载的书名、作者、关键词",
  },
  {
    id: "content",
    label: "内容清洗",
    icon: Sparkles,
    desc: "删除广告行、剥离章节导航文字",
  },
];

export function FilterPage() {
  const [activeTab, setActiveTab] = useState<TabId>("blacklist");

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader title="过滤中心" subtitle="黑名单管理，内容清洗规则" />

      {/* Tab bar */}
      <div
        className="flex shrink-0 items-center gap-1 rounded-xl p-1"
        style={{ background: "var(--color-surface-2)", width: "fit-content" }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: isActive ? "var(--color-surface)" : "transparent",
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                border: isActive ? "1px solid var(--color-border)" : "1px solid transparent",
              }}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1">
        {activeTab === "blacklist" && <BlacklistTab />}
        {activeTab === "content" && <ContentCleanTab />}
      </div>
    </div>
  );
}
