import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScanTab } from "@/components/ScanTab";
import { LibraryTab } from "@/components/LibraryTab";
import type { SavedScan } from "@/lib/library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Akshara Setu — ಅಕ್ಷರ ಸೇತು" },
      {
        name: "description",
        content: "A bridge from Kannada pages to editable, searchable text.",
      },
      { property: "og:title", content: "Akshara Setu — ಅಕ್ಷರ ಸೇತು" },
      {
        property: "og:description",
        content: "A bridge from Kannada pages to editable, searchable text.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

function App() {
  const [tab, setTab] = useState<"scan" | "library">("scan");
  const [reopenItem, setReopenItem] = useState<SavedScan | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              Akshara Setu <span className="gold-text">ಅಕ್ಷರ ಸೇತು</span>
            </h1>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">
              A bridge from Kannada pages to editable, searchable text.
            </p>
          </div>
          <nav className="flex gap-2">
            <button
              onClick={() => setTab("scan")}
              aria-current={tab === "scan" ? "page" : undefined}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                tab === "scan"
                  ? "bg-accent text-accent-foreground"
                  : "border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              Scan
            </button>
            <button
              onClick={() => setTab("library")}
              aria-current={tab === "library" ? "page" : undefined}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                tab === "library"
                  ? "bg-accent text-accent-foreground"
                  : "border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              Library
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {tab === "scan" ? (
          <ScanTab reopenItem={reopenItem} onReopenHandled={() => setReopenItem(null)} />
        ) : (
          <LibraryTab
            onOpenItem={(item) => {
              setReopenItem(item);
              setTab("scan");
            }}
          />
        )}
      </main>

      <footer className="border-t border-border bg-secondary">
        <p className="mx-auto max-w-4xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          Images are processed securely and never stored.
        </p>
      </footer>
    </div>
  );
}
