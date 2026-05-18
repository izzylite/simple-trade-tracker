/**
 * analyze_image — emits an [IMAGE_ANALYSIS:url] marker that the conversation
 * builder picks up and injects as inline_data so Gemini can see the image.
 *
 * Important: this tool is for *stored* images (trade.images[].url etc.).
 * Images the user attaches directly to their message are already visible
 * via the multimodal channel; calling this for those is wasteful.
 */

import { log } from "../../_shared/supabase.ts";
import type { GeminiFunctionDeclaration } from "./types.ts";

export const analyzeImageTool: GeminiFunctionDeclaration = {
  name: "analyze_image",
  description:
    "Analyze a stored trade image by its URL. Use this ONLY for image URLs retrieved from the database (e.g. trade.images[].url). Do NOT use this for images the user has directly attached to their message — those are already visible to you as inline images and you should describe them directly without calling this tool.",
  parameters: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "The URL of the image to analyze",
      },
      analysis_focus: {
        type: "string",
        description:
          "What to focus the analysis on: 'general' for non-chart images (screenshots, diagrams, notes), or chart-specific: entry, exit, patterns, levels, overview",
        enum: ["general", "entry", "exit", "patterns", "levels", "overview"],
      },
      trade_context: {
        type: "string",
        description:
          'Optional context to help interpret the image (e.g., "Long EUR/USD, won 2R" for charts, or "Risk management rules" for note images)',
      },
    },
    required: ["image_url"],
  },
};

function isStockImageUrl(url: string): boolean {
  const stockDomains = [
    "unsplash.com",
    "images.unsplash.com",
    "pexels.com",
    "pixabay.com",
    "stock",
    "placeholder",
    "via.placeholder.com",
  ];
  return stockDomains.some((domain) => url.toLowerCase().includes(domain));
}

function analyzeImage(
  imageUrl: string,
  analysisFocus: string = "overview",
  tradeContext?: string,
): string {
  try {
    if (isStockImageUrl(imageUrl)) {
      log(`Skipping stock image: ${imageUrl.substring(0, 50)}...`, "info");
      return `This appears to be a stock/placeholder image (${
        imageUrl.substring(0, 30)
      }...) and not an actual trade chart. Skipping analysis. Please provide a real trade chart image for analysis.`;
    }

    log(
      `Preparing image for analysis: ${imageUrl.substring(0, 50)}...`,
      "info",
    );

    const focusPrompts: Record<string, string> = {
      entry:
        "Focus on analyzing the entry point: Was the entry well-timed? What price action or patterns preceded the entry? Was there confluence?",
      exit:
        "Focus on analyzing the exit: Was the exit optimal? Was profit left on the table? Was the stop loss placement appropriate?",
      patterns:
        "Focus on identifying chart patterns: What patterns are visible (head & shoulders, flags, wedges, etc.)? Are there trend lines or channels?",
      levels:
        "Focus on support/resistance levels: Identify key horizontal levels, trend lines, and areas of interest. Where are the key decision points?",
      overview:
        "Provide a general analysis of this trade chart including: entry/exit quality, patterns, key levels, and any notable observations.",
      general:
        "Describe this image in detail. What do you see? If it's a chart, describe the price action. If it's a screenshot, describe the content. If it's a diagram or reference material, explain what it shows.",
    };

    const focusInstruction = focusPrompts[analysisFocus] ||
      focusPrompts.overview;
    const contextNote = tradeContext ? ` Context: "${tradeContext}".` : "";

    const isGeneralFocus = analysisFocus === "general";
    const taskInstruction = isGeneralFocus
      ? "YOUR TASK: Describe what you SEE in this image and respond with your findings (3-5 bullet points). Be specific about visual elements, text, diagrams, or any relevant details."
      : "YOUR TASK: Analyze what you SEE in this image and respond with your findings (3-5 bullet points). Describe specific visual elements you observe: candlesticks, indicators, levels, patterns, entry/exit markers, platform UI, annotations, etc.";

    return `[IMAGE_ANALYSIS:${imageUrl}]
IMAGE LOADED SUCCESSFULLY. You are now viewing the image above.
${focusInstruction}${contextNote}
${taskInstruction}`;
  } catch (error) {
    log(`Image preparation error: ${error}`, "error");
    return `Image analysis error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export function executeAnalyzeImage(args: Record<string, unknown>): string {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : "";
  const analysisFocus = typeof args.analysis_focus === "string"
    ? args.analysis_focus
    : "overview";
  const tradeContext = typeof args.trade_context === "string"
    ? args.trade_context
    : undefined;
  return analyzeImage(imageUrl, analysisFocus, tradeContext);
}
