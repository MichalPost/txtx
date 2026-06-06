import { useState } from "react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { DEFAULT_SITE, generateSiteKey } from "./rulesPageUtils";
import type { WebsiteConfig } from "@/types";

export function useRulesPageActions() {
  const { config, saveConfig, saving } = useConfigStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recentlySavedKey, setRecentlySavedKey] = useState<string | null>(null);

  const handleNewSite = () => {
    if (!config) return;
    const key = generateSiteKey(Object.keys(config.websites));
    setEditingKey(key);
  };

  const handleWizardApply = (key: string, patch: Partial<WebsiteConfig>) => {
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

    saveConfig({
      ...config,
      network: { ...config.network, encoding_map: encodingMap },
      websites: { ...websites, [key]: updatedSite },
    });
    setRecentlySavedKey(key);
    setEditingKey(null);
  };

  const handleWizardClose = () => setEditingKey(null);

  const toggleEnabled = (key: string) => {
    if (!config) return;
    const websites = config.websites;
    saveConfig({
      ...config,
      websites: {
        ...websites,
        [key]: { ...websites[key], enabled: !websites[key].enabled },
      },
    }, true);
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
    saveConfig({
      ...config,
      network: { ...config.network, encoding_map: encodingMap },
      websites: updated,
    }, true);
    if (editingKey === key) setEditingKey(null);
  };

  const getRuleStatus = (site: WebsiteConfig) => {
    const required = [
      site.domain_name,
      site.list_novel_name,
      site.release_url,
      site.novel_content,
    ];
    const filled = required.filter(Boolean).length;
    return { filled, total: required.length, complete: filled === required.length };
  };

  const quickSave = (key: string, patch: Partial<WebsiteConfig>) => {
    if (!config) return;
    const websites = config.websites;
    saveConfig(
      {
        ...config,
        websites: { ...websites, [key]: { ...websites[key], ...patch } },
      },
      true, // silent
    );
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
  };
}
