/**
 * useSourceFetch — 管理 SourceViewer 的 URL/HTML 获取状态
 */
import { useState } from "react";
import { apiFetchSource } from "@/lib/api/files";

export function useSourceFetch(defaultUrl = "") {
  const [url, setUrl] = useState(defaultUrl);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSource = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setHtml("");
    try {
      const result = await apiFetchSource(url.trim());
      setHtml(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return { url, setUrl, html, setHtml, loading, error, fetchSource };
}
