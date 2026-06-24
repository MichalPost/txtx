import { useMemo, useState } from "react";

export interface PathListItem {
  id: string;
  path: string;
}

function createItem(path = ""): PathListItem {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path,
  };
}

export function usePathList(initialPaths: string[] = [""]) {
  const [items, setItems] = useState<PathListItem[]>(() => initialPaths.map((path) => createItem(path)));

  const addPath = (path = "") =>
    setItems((current) => {
      const firstEmptyIndex = current.findIndex((item) => item.path.trim().length === 0);
      if (path.trim().length > 0 && firstEmptyIndex >= 0) {
        return current.map((item, index) =>
          index === firstEmptyIndex ? { ...item, path } : item,
        );
      }
      return [...current, createItem(path)];
    });
  const removePath = (id: string) => setItems((current) => current.filter((item) => item.id !== id));
  const updatePath = (id: string, value: string) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, path: value } : item)));
  const paths = useMemo(() => items.map((item) => item.path), [items]);

  return { items, paths, addPath, removePath, updatePath };
}
