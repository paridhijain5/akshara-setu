import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { deleteScan, listScans, type SavedScan } from "@/lib/library";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function LibraryTab({ onOpenItem }: { onOpenItem: (item: SavedScan) => void }) {
  const [items, setItems] = useState<SavedScan[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listScans().then(setItems).catch(() => setItems([]));
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(items ?? [], {
        keys: ["text", "title"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [items],
  );

  const results = useMemo(() => {
    if (!items) return [];
    if (!query.trim()) return items;
    return fuse.search(query.trim()).map((r) => r.item);
  }, [items, query, fuse]);

  if (items === null) {
    return <p className="text-sm text-muted-foreground">Loading your library…</p>;
  }

  const totalPages = items.length;
  const totalWords = items.reduce((sum, s) => sum + countWords(s.text), 0);
  const lastSaved = items.length > 0 ? formatDate(Math.max(...items.map((s) => s.createdAt))) : "—";

  async function handleDelete(id: string) {
    await deleteScan(id);
    setItems(await listScans());
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pages saved
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{totalPages}</p>
        </div>
        <div className="card-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total words
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{totalWords.toLocaleString("en-IN")}</p>
        </div>
        <div className="card-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Last saved
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{lastSaved}</p>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search saved pages…"
        className="w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />

      {totalPages === 0 ? (
        <div className="card-raised p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No saved pages yet. Scan a Kannada page and tap “Save to Library” to see it here.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="card-raised p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No pages match “{query}”. Try a different word.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((item) => (
            <li key={item.id} className="card-raised flex gap-3 p-3">
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-20 w-16 flex-none rounded-lg border border-border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                  <span className="flex-none text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.text}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-base btn-outline !px-3 !py-1 !text-xs"
                    onClick={() => onOpenItem(item)}
                  >
                    Open in Scan
                  </button>
                  <button
                    type="button"
                    className="btn-base btn-outline !px-3 !py-1 !text-xs !text-destructive !border-destructive/40 hover:!bg-destructive/10"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
