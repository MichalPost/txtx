import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { animateFadeInUp } from "@/lib/animations";
import { apiGetHistoryStats } from "@/lib/api";

const PIE_COLORS = [
  "var(--color-accent)",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export function useHistoryStats(days = 30) {
  const { data, isLoading } = useQuery({
    queryKey: ["history-stats", days],
    queryFn: () => apiGetHistoryStats(days),
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && containerRef.current) {
      animateFadeInUp(containerRef.current, 0);
    }
  }, [isLoading]);

  const daily = data?.daily ?? [];
  const sites = (data?.sites ?? []).map((s, i) => ({
    ...s,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return { isLoading, daily, sites, containerRef };
}
