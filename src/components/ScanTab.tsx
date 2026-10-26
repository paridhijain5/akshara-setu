import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ocrKannada } from "@/lib/ocr.functions";
import {
  makeThumbnail,
  prepareImage,
  preprocessForOfflineOcr,
  runOfflineOcr,
  type PreparedImage,
} from "@/lib/ocr-client";
import { extractKeyDetails, type KeyDetail } from "@/lib/key-details";
import { transliterate } from "@/lib/transliterate";
import { makeTitle, saveScan } from "@/lib/library";
import sampleKarnataka from "@/assets/karnataka.png";
import sampleKuvempu from "@/assets/kuvempu.png";
import type { SavedScan } from "@/lib/library";

type Engine = "AI OCR" | "Offline OCR" | null;

const OFFLINE_MSG =
  "You seem to be offline, so the AI reader was skipped and offline OCR was used.";

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export function ScanTab({
  reopenItem,
  onReopenHandled,
}: {
  reopenItem: SavedScan | null;
  onReopenHandled: () => void;
}) {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [fromLibrary, setFromLibrary] = useState(false);
  const [text, setText] = useState("");
  const [hasText, setHasText] = useState(false);
  const [engine, setEngine] = useState<Engine>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translationLang, setTranslationLang] = useState<"en" | "hi">("en");
  const [roman, setRoman] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);

  // Read-along state
  const [speaking, setSpeaking] = useState(false);
  const [activeWord, setActiveWord] = useState<number | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const readAlongRef = useRef<HTMLDivElement | null>(null);

  const runOcrFn = useServerFn(ocrKannada);

  const keyDetails = useMemo<KeyDetail[]>(() => (hasText ? extractKeyDetails(text) : []), [text, hasText]);

  // Word index for read-along highlighting
  const words = useMemo(() => {
    const list: { word: string; start: number }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) list.push({ word: m[0], start: m.index });
    return list;
  }, [text]);

  useEffect(() => {
    if (!reopenItem) return;
    setImage({
      blob: new Blob(),
      previewUrl: reopenItem.thumbnail,
      ocrBase64: "",
    });
    setFromLibrary(true);
    setText(reopenItem.text);
    setHasText(true);
    setEngine(null);
    setScanError(null);
    setOfflineNote(null);
    setTranslation(null);
    setRoman(null);
    setSummary(null);
    setSavedFlash(false);
    onReopenHandled();
  }, [reopenItem, onReopenHandled]);

  // Stop speech when leaving the page
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function loadBlob(blob: Blob) {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setScanError(null);
    setOfflineNote(null);
    setTranslation(null);
    setRoman(null);
    setSummary(null);
    setSavedFlash(false);
    setFromLibrary(false);
    try {
      const prepared = await prepareImage(blob);
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return prepared;
      });
      setText("");
      setHasText(false);
      setEngine(null);
      await scanPrepared(prepared);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadSample(url: string) {
    try {
      setScanning(true);
      const blob = await blobFromUrl(url);
      await loadBlob(blob);
    } catch {
      setScanning(false);
      setScanError("The sample image could not be loaded. Please try again.");
    }
  }

  function resetToolResults() {
    setTranslation(null);
    setRoman(null);
    setSummary(null);
    setActionError(null);
  }

  async function scanPrepared(prepared: PreparedImage) {
    setScanning(true);
    setEngine(null);
    resetToolResults();
    let aiFailureMessage: string | null = null;

    // 1) AI OCR (skipped when offline)
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      try {
        const result = await runOcrFn({ data: { imageBase64: prepared.ocrBase64 } });
        if (result.ok) {
          setText(result.text);
          setHasText(true);
          setEngine("AI OCR");
          setOfflineNote(null);
          setScanning(false);
          return;
        }
        aiFailureMessage = result.message;
      } catch {
        aiFailureMessage = "The AI reading service could not be reached.";
      }
    }

    // 2) Offline fallback: Tesseract.js on a grayscale + contrast copy
    try {
      const canvas = await preprocessForOfflineOcr(prepared.blob);
      const offlineText = await runOfflineOcr(canvas);
      if (!offlineText) throw new Error("No text detected");
      setText(offlineText);
      setHasText(true);
      setEngine("Offline OCR");
      setOfflineNote(aiFailureMessage ?? OFFLINE_MSG);
      setScanError(null);
      setScanning(false);
    } catch (offlineError) {
      setScanError(
        offlineError instanceof Error && offlineError.message !== "No text detected"
          ? `Scanning failed. ${offlineError.message}`
          : aiFailureMessage
            ? `Scanning failed. ${aiFailureMessage} Offline OCR could not read this image either. Please try a clearer photo.`
            : "Scanning failed and offline OCR could not read this image. Please try a clearer photo.",
      );
      setScanning(false);
    }
  }

  async function retryScan() {
    if (image) await scanPrepared(image);
  }

  async function copyText() {
    setBusyAction("copy");
    setActionError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1500);
    } catch {
      setActionError("Copying to the clipboard was blocked by your browser.");
    } finally {
      setBusyAction(null);
    }
  }

  function downloadTxt() {
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `akshara-setu-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setActionError("The text file could not be downloaded.");
    }
  }

  function exportJson() {
    try {
      const payload = {
        text,
        translation: translation,
        translationLanguage: translation ? translationLang : null,
        keyDetails: keyDetails.map((d) => ({ kind: d.kind, value: d.value })),
        date: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `akshara-setu-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setActionError("The JSON file could not be exported.");
    }
  }

  async function saveToLibrary() {
    setBusyAction("save");
    setActionError(null);
    try {
      const thumbnail = image ? await makeThumbnail(image.blob) : "";
      await saveScan({
        id: crypto.randomUUID(),
        title: makeTitle(text),
        text,
        thumbnail,
        createdAt: Date.now(),
      });
      setSavedFlash(true);
    } catch {
      setActionError("The page could not be saved to your library.");
    } finally {
      setBusyAction(null);
    }
  }

  function toggleListen() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setActiveWord(null);
      return;
    }
    if (!("speechSynthesis" in window)) {
      setVoiceMessage("Kannada voice not available on this device");
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    const kannadaVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("kn"));
    if (!kannadaVoice) {
      setVoiceMessage("Kannada voice not available on this device");
      return;
    }
    setVoiceMessage(null);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "kn-IN";
    if (kannadaVoice) utterance.voice = kannadaVoice;
    utterance.onboundary = (event) => {
      const index = words.findIndex(
        (w) => event.charIndex >= w.start && event.charIndex < w.start + w.word.length,
      );
      if (index >= 0) {
        setActiveWord(index);
        readAlongRef.current
          ?.querySelectorAll("[data-word-index]")
          ?.item(index)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };
    utterance.onend = () => {
      setSpeaking(false);
      setActiveWord(null);
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setActiveWord(null);
      setVoiceMessage("Reading was interrupted. Please try again.");
    };
    setActiveWord(null);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function chunkForMyMemory(input: string, max = 450): string[] {
    const chunks: string[] = [];
    let current = "";
    const parts = input.split(/\n/);
    for (const line of parts) {
      const sentences = line.split(/(?<=[.!?।])\s+/);
      for (const sentence of sentences) {
        const piece = sentence + " ";
        if (piece.length > max) {
          if (current) {
            chunks.push(current.trim());
            current = "";
          }
          for (let i = 0; i < piece.length; i += max) chunks.push(piece.slice(i, i + max).trim());
          continue;
        }
        if ((current + piece).length > max) {
          chunks.push(current.trim());
          current = piece;
        } else {
          current += piece;
        }
      }
      current += "\n";
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  async function translate() {
    setBusyAction("translate");
    setActionError(null);
    try {
      const chunks = chunkForMyMemory(text);
      const translated: string[] = [];
      for (const chunk of chunks) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=kn|${translationLang}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Translation service returned ${res.status}`);
        const data = (await res.json()) as { responseStatus?: number; responseData?: { translatedText?: string }; responseDetails?: string };
        if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
          throw new Error(data.responseDetails || "The translation service could not translate this text.");
        }
        translated.push(data.responseData.translatedText);
      }
      setTranslation(translated.join("\n"));
    } catch (e) {
      setTranslation(null);
      setActionError(
        e instanceof Error
          ? `Translation failed. ${e.message}`
          : "Translation failed. Please try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function romanize() {
    setBusyAction("romanize");
    setActionError(null);
    try {
      setRoman(transliterate(text));
    } catch {
      setActionError("Transliteration failed unexpectedly.");
    } finally {
      setBusyAction(null);
    }
  }

  function quickSummary() {
    setBusyAction("summarize");
    setActionError(null);
    try {
      const sentences = text.replace(/\n+/g, " ").split(/(?<=[.!?।])\s+/).filter((s) => s.trim());
      if (sentences.length === 0) {
        setSummary(null);
        setActionError("There is no text to summarize yet.");
      } else {
        setSummary(sentences.slice(0, 2).join(" ").trim());
      }
    } finally {
      setBusyAction(null);
    }
  }

  const busy = scanning || busyAction !== null;

  return (
    <div className="space-y-6">
      <section className="card-raised p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <label className="btn-base btn-primary">
            Upload image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={scanning}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadBlob(file);
                e.target.value = "";
              }}
            />
          </label>
          <label className="btn-base btn-outline">
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={scanning}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadBlob(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="btn-base btn-outline"
            disabled={scanning}
            onClick={() => loadSample(sampleKarnataka)}
          >
            Sample: Karnataka
          </button>
          <button
            type="button"
            className="btn-base btn-outline"
            disabled={scanning}
            onClick={() => loadSample(sampleKuvempu)}
          >
            Sample: Kuvempu
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: Crop to one clear paragraph of printed Kannada for best results.
        </p>
      </section>

      {image && (
        <section className="card-raised overflow-hidden">
          <div className="relative bg-secondary">
            {/* Always show the ORIGINAL image, never a processed canvas */}
            <img
              src={image.previewUrl}
              alt="Page to scan"
              className="mx-auto max-h-[480px] w-auto max-w-full object-contain"
            />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-background/75">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm font-semibold text-primary">Reading Kannada...</span>
              </div>
            )}
            {engine && !scanning && (
              <span className="chip absolute right-3 top-3 !bg-card/90">{engine}</span>
            )}
          </div>
        </section>
      )}

      {scanError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{scanError}</p>
          {image && (
            <button type="button" className="btn-base btn-primary mt-3" onClick={retryScan}>
              Retry
            </button>
          )}
        </div>
      )}

      {hasText && (
        <section className="card-raised p-4 sm:p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
            Recognized text
          </h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(18, Math.max(5, text.split("\n").length + 1))}
            className="mt-3 w-full resize-y rounded-lg border border-input bg-card p-3 text-base leading-relaxed text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {offlineNote && (
            <p className="mt-2 text-xs text-muted-foreground">Offline OCR used. {offlineNote}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-base btn-outline"
              disabled={busy || fromLibrary}
              title={fromLibrary ? "Re-scanning needs a freshly loaded image" : undefined}
              onClick={retryScan}
            >
              Re-scan
            </button>
            <button type="button" className="btn-base btn-outline" disabled={busy} onClick={copyText}>
              {copiedFlash ? "Copied ✓" : "Copy"}
            </button>
            <button type="button" className="btn-base btn-outline" disabled={busy} onClick={downloadTxt}>
              Download .txt
            </button>
            <button type="button" className="btn-base btn-outline" disabled={busy} onClick={exportJson}>
              Export JSON
            </button>
            <button
              type="button"
              className="btn-base btn-primary"
              disabled={busy || savedFlash}
              onClick={saveToLibrary}
            >
              {savedFlash ? "Saved to Library ✓" : "Save to Library"}
            </button>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Tools</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`btn-base ${speaking ? "btn-primary" : "btn-outline"}`}
                disabled={busyAction !== null}
                onClick={toggleListen}
              >
                {speaking ? "Stop" : "Listen"}
              </button>
              <select
                value={translationLang}
                onChange={(e) => {
                  setTranslationLang(e.target.value as "en" | "hi");
                  setTranslation(null);
                }}
                className="rounded-full border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-ring"
                aria-label="Translation language"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <button
                type="button"
                className="btn-base btn-outline"
                disabled={busy}
                onClick={translate}
              >
                {busyAction === "translate" ? "Translating…" : "Translate"}
              </button>
              <button
                type="button"
                className="btn-base btn-outline"
                disabled={busy}
                onClick={romanize}
              >
                {busyAction === "romanize" ? "Working…" : "Read in English letters"}
              </button>
              <button
                type="button"
                className="btn-base btn-outline"
                disabled={busy}
                onClick={quickSummary}
              >
                Summarize
              </button>
            </div>
            {voiceMessage && <p className="mt-2 text-xs text-muted-foreground">{voiceMessage}</p>}
            {actionError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {actionError}
              </p>
            )}

            {speaking && (
              <div
                ref={readAlongRef}
                className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-secondary p-3 text-base leading-loose"
              >
                {words.map((w, i) => (
                  <span
                    key={i}
                    data-word-index={i}
                    className={`read-along-word ${i === activeWord ? "active" : ""}`}
                  >
                    {w.word}{" "}
                  </span>
                ))}
              </div>
            )}

            {translation && (
              <div className="mt-4 rounded-xl bg-secondary p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                  Translation ({translationLang === "en" ? "English" : "Hindi"})
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm">{translation}</p>
              </div>
            )}
            {roman && (
              <div className="mt-4 rounded-xl bg-secondary p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                  Kannada in English letters
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm italic">{roman}</p>
              </div>
            )}
            {summary && (
              <div className="mt-4 rounded-xl bg-secondary p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-primary">
                  Quick summary
                </h4>
                <p className="mt-2 text-sm">{summary}</p>
              </div>
            )}
          </div>

          {keyDetails.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
                Key details found
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyDetails.map((d, i) => (
                  <span key={i} className="chip">
                    <span className="font-bold text-accent-foreground">{d.kind}</span>
                    {d.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
