import { useMemo, useState } from "react";

import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { buildBookNameXPath } from "../components/BookNameConfig";
import { useWizardListRulesAi } from "./useWizardListRulesAi";
import type { FieldRule, WizardData } from "../ruleUtils";

export const LIST_RULES_COMMON_RULES = [
  { label: "-- 常用规则 --", value: "" },
  { label: "a 链接文本", value: "//a/text()" },
  { label: "li > a 链接文本", value: "//li/a/text()" },
  { label: "ul li a 链接文本", value: "//ul/li/a/text()" },
  { label: "dt/dd 链接", value: "//dt/a/@href" },
  { label: "h3 > a 文本", value: "//h3/a/text()" },
  { label: "div.list a 文本", value: "//div[contains(@class,'list')]//a/text()" },
  { label: "div.chapter a 文本", value: "//div[contains(@class,'chapter')]//a/text()" },
  { label: "div.catalog a 文本", value: "//div[contains(@class,'catalog')]//a/text()" },
  { label: "table td a 链接", value: "//table//td/a/@href" },
];

export const LIST_RULES_ENCODING_OPTIONS = [
  { label: "自动检测", value: "auto" },
  { label: "UTF-8", value: "utf-8" },
  { label: "GBK", value: "gbk" },
  { label: "GB2312", value: "gb2312" },
  { label: "Big5", value: "big5" },
];

export function useListRulesStep(data: WizardData, onChange: (d: WizardData) => void) {
  const [errorMsg, setErrorMsg] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [encoding, setEncoding] = useState("auto");
  const [bookNameTestResult, setBookNameTestResult] = useState<{
    count: number;
    sample: string;
  } | null>(null);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);

  const patch = (
    key: keyof Pick<WizardData, "list_novel_name" | "list_release_date" | "list_release_url">,
    rule: FieldRule,
  ) => onChange({ ...data, [key]: rule });

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先在第三步填写并获取目录页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, catalog_html: html });
    return html;
  };

  const { aiEnabled, aiLoading, runBatchAi, runFieldAi } = useWizardListRulesAi(
    data,
    onChange,
    ensureHtml,
    setErrorMsg,
  );

  const applyCommonRule = (xpath: string) => {
    if (!xpath) return;
    onChange({
      ...data,
      list_release_url: { ...data.list_release_url, mode: "xpath", xpath },
    });
  };

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates = [
        "//div[contains(@class,'list')]//a/@href",
        "//div[contains(@class,'chapter')]//a/@href",
        "//div[contains(@class,'catalog')]//a/@href",
        "//ul[contains(@class,'list')]//a/@href",
        "//ul//li/a/@href",
        "//dl//dd/a/@href",
        "//table//td/a/@href",
      ];
      let bestXpath = "";
      let bestCount = 0;
      for (const xpath of candidates) {
        try {
          const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snap.snapshotLength > bestCount) {
            bestCount = snap.snapshotLength;
            bestXpath = xpath;
          }
        } catch {
          /* skip */
        }
      }
      if (bestXpath) {
        onChange({
          ...data,
          catalog_html: html,
          list_release_url: { ...data.list_release_url, mode: "xpath", xpath: bestXpath },
        });
      } else {
        setErrorMsg("自动匹配未找到合适规则，请手动设置");
      }
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const handleViewSource = async () => {
    setErrorMsg("");
    try {
      await ensureHtml();
      setShowSource((v) => !v);
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const bookNameXPathPreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.catalog_html) {
      setErrorMsg("请先获取页面源码");
      return;
    }
    if (!bookNameXPathPreview) {
      setBookNameTestResult(null);
      return;
    }
    const v = validateXPath(data.catalog_html, bookNameXPathPreview);
    setBookNameTestResult({ count: v.count, sample: v.samples[0] ?? "" });
  };

  return {
    aiEnabled,
    aiLoading,
    applyCommonRule,
    autoMatchLoading,
    bookNameTestResult,
    bookNameXPathPreview,
    encoding,
    errorMsg,
    handleViewSource,
    patch,
    runAutoMatch,
    runBatchAi,
    runFieldAi,
    setEncoding,
    showSource,
    testBookName,
  };
}
