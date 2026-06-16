import { useState } from "react";
import { toast } from "sonner";

import { useConfigStore } from "@/store/configStore";
import type { WebsiteConfig } from "@/types";

import { saveRuleConfigAndThen } from "./ruleSaveFlow";
import { DEFAULT_SITE, generateSiteKey } from "./rulesPageUtils";

export function useRulesPageActions() {
  const { config, saveConfig, saving } = useConfigStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recentlySavedKey, setRecentlySavedKey] = useState<string | null>(null);

  const handleNewSite = () => {
    if (!config) return;
    const key = generateSiteKey(Object.keys(config.websites));
    setEditingKey(key);
  };

  const handleWizardApply = async (key: string, patch: Partial<WebsiteConfig>) => {
    if (!config) return;
    const websites = config.websites;
    const base = websites[key] ?? { ...DEFAULT_SITE };
    const updatedSite: WebsiteConfig = { ...base, ...patch };
    let hostname = "";

    // Sync encoding to network.encoding_map
    // Extract the hostname from domain_name to use as the map key
    const encodingMap = { ...(config.network.encoding_map ?? {}) };
    try {
      hostname = new URL(updatedSite.domain_name).hostname;
    } catch {
      hostname = updatedSite.domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    const duplicateKey = Object.entries(websites).find(([siteKey, site]) => {
      if (siteKey === key) return false;
      const siteHostname = (() => {
        try {
          return new URL(site.domain_name).hostname;
        } catch {
          return site.domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        }
      })();
      return hostname && siteHostname && siteHostname === hostname;
    })?.[0];

    if (duplicateKey) {
      toast.error(`已存在相同域名规则：${duplicateKey}`);
      return;
    }

    if (hostname) {
      if (updatedSite.encoding?.trim()) {
        encodingMap[hostname] = updatedSite.encoding.trim();
      } else {
        // Remove the entry if encoding was cleared
        delete encodingMap[hostname];
      }
    }

    await saveRuleConfigAndThen(
      () =>
        saveConfig({
          ...config,
          network: { ...config.network, encoding_map: encodingMap },
          websites: { ...websites, [key]: updatedSite },
        }),
      () => {
        setRecentlySavedKey(key);
        setEditingKey(null);
      },
    );
  };

  const handleWizardClose = () => setEditingKey(null);

  const toggleEnabled = (key: string) => {
    if (!config) return;
    const websites = config.websites;
    saveConfig(
      {
        ...config,
        websites: {
          ...websites,
          [key]: { ...websites[key], enabled: !websites[key].enabled },
        },
      },
      true,
    );
  };

  const deleteSite = (key: string) => {
    if (!config) return;
    const websites = config.websites;
    const confirmed = confirm(`确认删除规则「${key}」吗？删除后无法恢复。`);
    if (!confirmed) return;
    const updated = { ...websites };
    delete updated[key];
    const encodingMap = { ...(config.network.encoding_map ?? {}) };
    try {
      const hostname = new URL(websites[key].domain_name).hostname;
      if (hostname) delete encodingMap[hostname];
    } catch {
      const hostname = websites[key].domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (hostname) delete encodingMap[hostname];
    }
    saveConfig(
      {
        ...config,
        network: { ...config.network, encoding_map: encodingMap },
        websites: updated,
      },
      true,
    );
    if (editingKey === key) setEditingKey(null);
  };

  const getRuleStatus = (site: WebsiteConfig) => {
    const required = [site.domain_name, site.list_novel_name, site.release_url, site.novel_content];
    const filled = required.filter(Boolean).length;
    return { filled, total: required.length, complete: filled === required.length };
  };

  const quickSave = async (key: string, patch: Partial<WebsiteConfig>) => {
    if (!config) return;
    const websites = config.websites;
    await saveConfig(
      {
        ...config,
        websites: { ...websites, [key]: { ...websites[key], ...patch } },
      },
      true, // silent
    );
  };

  const duplicateSite = async (key: string) => {
    if (!config) return;
    const websites = config.websites;
    const base = websites[key];
    if (!base) return;

    // Generate a unique new key: try ${key}_copy, then ${key}_copy2, _copy3, etc.
    let newKey = `${key}_copy`;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(websites, newKey)) {
      newKey = `${key}_copy${suffix}`;
      suffix += 1;
    }

    const newSite: WebsiteConfig = { ...base, domain_name: "https://", enabled: true };

    await saveRuleConfigAndThen(
      () =>
        saveConfig(
          {
            ...config,
            websites: { ...websites, [newKey]: newSite },
          },
          true,
        ),
      () => {
        setEditingKey(newKey);
      },
    );
  };

  const reorderSites = async (orderedKeys: string[]) => {
    if (!config) return;
    const websites = config.websites;
    const sitePriority: Record<string, number> = {};
    orderedKeys.forEach((key, index) => {
      const site = websites[key];
      if (site) {
        sitePriority[site.domain_name] = index + 1;
      }
    });
    await saveConfig(
      {
        ...config,
        filtering: { ...config.filtering, site_priority: sitePriority },
      },
      true,
    );
  };

  const exportSites = async () => {
    if (!config) return;
    try {
      const { apiSaveTextFile } = await import("@/lib/api");
      const content = JSON.stringify(config.websites, null, 2);
      await apiSaveTextFile("websites-config.json", content);
      toast.success("导出成功");
    } catch (err) {
      toast.error(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const importSites = () => {
    if (!config) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result as string) as Record<string, WebsiteConfig>;
          const keys = Object.keys(parsed);
          const firstVal = keys.length > 0 ? parsed[keys[0]] : undefined;
          if (keys.length === 0 || firstVal?.domain_name === undefined) {
            toast.error("文件格式不正确，无法导入");
            return;
          }
          const merged = { ...config.websites, ...parsed };
          await saveConfig(
            {
              ...config,
              websites: merged,
            },
            true,
          );
          toast.success(`已导入 ${keys.length} 个站点`);
        } catch (err) {
          toast.error(`导入失败：${err instanceof Error ? err.message : String(err)}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return {
    config,
    saving,
    editingKey,
    setEditingKey,
    recentlySavedKey,
    handleNewSite,
    handleWizardApply,
    handleWizardClose,
    toggleEnabled,
    deleteSite,
    getRuleStatus,
    quickSave,
    duplicateSite,
    reorderSites,
    exportSites,
    importSites,
  };
}
