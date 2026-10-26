import { createStore, get, set, del, keys as idbKeys } from "idb-keyval";

export type SavedScan = {
  id: string;
  title: string;
  text: string;
  thumbnail: string;
  createdAt: number;
};

const store = createStore("akshara-setu", "scans");

export function saveScan(scan: SavedScan): Promise<void> {
  return set(scan.id, scan, store);
}

export async function listScans(): Promise<SavedScan[]> {
  const allKeys = await idbKeys(store);
  const scans = await Promise.all(allKeys.map((k) => get<SavedScan>(k, store)));
  return scans
    .filter((s): s is SavedScan => Boolean(s))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteScan(id: string): Promise<void> {
  return del(id, store);
}

export function makeTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 48)}…` : t || "Untitled scan";
}
