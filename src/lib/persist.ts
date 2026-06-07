/**
 * IndexedDB 持久化工具
 * 基于 idb-keyval，用于保存 UI 状态（非配置数据）
 */

/** React hook: read a persisted value on mount, write on change */
import { useEffect, useRef, useState } from "react";
import { del, get, set } from "idb-keyval";

const PREFIX = "txtx:";

export async function persistGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const val = await get<T>(`${PREFIX}${key}`);
    return val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
}

export async function persistSet<T>(key: string, value: T): Promise<void> {
  try {
    await set(`${PREFIX}${key}`, value);
  } catch {
    // IndexedDB unavailable in some Tauri contexts, ignore
  }
}

export async function persistDel(key: string): Promise<void> {
  try {
    await del(`${PREFIX}${key}`);
  } catch {
    // key not found or IndexedDB unavailable, ignore
  }
}

export function usePersistedState<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  const loaded = useRef(false);
  // Keep a stable ref to the latest fallback so the effect always uses the
  // current value even if the caller passes a new reference each render.
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });

  useEffect(() => {
    persistGet<T>(key, fallbackRef.current).then((v) => {
      setValue(v);
      loaded.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set_ = (v: T) => {
    setValue(v);
    persistSet(key, v);
  };

  return [value, set_];
}
