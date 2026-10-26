import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type OcrResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

function friendlyAiError(error: unknown): string {
  const err = error as { message?: string; statusCode?: number; responseBody?: unknown };
  const status = err?.statusCode;
  const bodyMessage =
    err?.responseBody && typeof err.responseBody === "object"
      ? String((err.responseBody as { message?: string }).message ?? "")
      : "";

  if (status === 402 || bodyMessage.toLowerCase().includes("credit")) {
    return "The AI reading service is out of credits right now. You can still use offline OCR below.";
  }
  if (status === 429) {
    return "The AI reading service is busy right now. Please try again in a moment.";
  }
  if (status === 403) {
    return "The AI reading service refused this request. You can still use offline OCR below.";
  }
  if (status === 401) {
    return "The AI reading service is not configured. You can still use offline OCR below.";
  }
  if (status && status >= 500) {
    return "The AI reading service had a temporary problem. You can still use offline OCR below.";
  }
  return "The AI reader could not process this image. You can still use offline OCR below.";
}

export const ocrKannada = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const input = data as { imageBase64?: string };
    if (typeof input?.imageBase64 !== "string" || input.imageBase64.length < 64) {
      throw new Error("No valid image was received for scanning.");
    }
    if (input.imageBase64.length > 8_000_000) {
      throw new Error("The image is too large. Please use a smaller photo.");
    }
    return { imageBase64: input.imageBase64 };
  })
  .handler(async ({ data }): Promise<OcrResult> => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) {
      return { ok: false, message: "The AI reading service is not configured." };
    }

    const provider = createLovableAiGatewayProvider(apiKey);
    const dataUrl = `data:image/jpeg;base64,${data.imageBase64}`;

    try {
      const result = streamText({
        model: provider("google/gemini-3.8-flash") as unknown as Parameters<
          typeof streamText
        >[0]["model"],
        maxRetries: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image: new URL(dataUrl) },
              {
                type: "text",
                text: "Transcribe all Kannada text in this image exactly, preserving line breaks. Output only the text, no commentary.",
              },
            ],
          },
        ],
      });
      const text = (await result.text).trim();
      if (!text) {
        return {
          ok: false,
          message: "No readable Kannada text was found in this image. Try a clearer photo.",
        };
      }
      return { ok: true, text };
    } catch (error) {
      console.error("[ocr-kannada] AI OCR failed", error);
      return { ok: false, message: friendlyAiError(error) };
    }
  });
