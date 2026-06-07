import type { ScanItem } from "@/types";

export function exportCsv(items: ScanItem[], onlySelected: boolean, selectedUrls: Set<string>) {
  const rows = onlySelected ? items.filter((i) => selectedUrls.has(i.url)) : items;
  const header = "书名,来源,日期,状态";
  const lines = rows.map(
    (i) =>
      `"${i.name.replace(/"/g, '""')}","${i.site}","${i.date}","${i.excluded_reason ?? "待下载"}"`,
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "书单.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(items: ScanItem[], onlySelected: boolean, selectedUrls: Set<string>) {
  const rows = onlySelected ? items.filter((i) => selectedUrls.has(i.url)) : items;
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "书单.json";
  a.click();
  URL.revokeObjectURL(url);
}
