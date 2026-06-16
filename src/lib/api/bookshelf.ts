import type { BookFile } from "@/types";
import { invokeDesktopCommand } from "@/platform";

import { API_BASE, IS_TAURI } from "./constants";

export async function apiListBooks(dir: string): Promise<BookFile[]> {
  if (IS_TAURI) {
    return invokeDesktopCommand<BookFile[]>("list_books", { dir });
  }
  const res = await fetch(`${API_BASE}/api/books?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDeleteBook(path: string): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("delete_book", { path });
  }
  const res = await fetch(`${API_BASE}/api/books`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiOpenBook(path: string): Promise<void> {
  if (IS_TAURI) {
    return invokeDesktopCommand("open_book", { path });
  }
  // Web mode: not supported
}
