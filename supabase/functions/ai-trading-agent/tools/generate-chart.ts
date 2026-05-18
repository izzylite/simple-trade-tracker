/**
 * generate_chart — QuickChart-rendered line/bar charts embedded inline.
 */

import { log } from "../../_shared/supabase.ts";
import type { GeminiFunctionDeclaration } from "./types.ts";

export const generateChartTool: GeminiFunctionDeclaration = {
  name: "generate_chart",
  description:
    "Generate a chart visualization from data. Returns HTML with an embedded image that displays inline in the chat. Use this after querying trade data via MCP tools to create visual representations like equity curves, P&L over time, or performance metrics.",
  parameters: {
    type: "object",
    properties: {
      chart_type: {
        type: "string",
        description: "Type of chart to generate",
        enum: ["line", "bar"],
      },
      title: {
        type: "string",
        description: "Chart title",
      },
      x_label: {
        type: "string",
        description: "X-axis label",
      },
      y_label: {
        type: "string",
        description: "Y-axis label",
      },
      labels: {
        type: "array",
        description: "Array of X-axis labels (e.g., dates, times)",
        items: { type: "string" },
      },
      datasets: {
        type: "array",
        description:
          "Array of dataset objects with {label: string, data: array of numbers, color: string}",
        items: { type: "object" },
      },
    },
    required: ["chart_type", "title", "labels", "datasets"],
  },
};

async function generateChart(
  chartType: string,
  title: string,
  xLabel: string,
  yLabel: string,
  labels: unknown[],
  datasets: unknown[],
): Promise<string> {
  try {
    if (!["line", "bar"].includes(chartType)) {
      return 'Invalid chart type. Use "line" or "bar".';
    }

    const chartConfig = {
      type: chartType,
      data: { labels, datasets },
      options: {
        title: { display: true, text: title, fontSize: 16 },
        scales: {
          xAxes: [{
            scaleLabel: { display: !!xLabel, labelString: xLabel },
          }],
          yAxes: [{
            scaleLabel: { display: !!yLabel, labelString: yLabel },
          }],
        },
        legend: { display: true, position: "bottom" },
      },
    };

    const chartConfigEncoded = encodeURIComponent(JSON.stringify(chartConfig));
    const chartUrl =
      `https://quickchart.io/chart?c=${chartConfigEncoded}&width=800&height=400&format=png`;

    log(`Generated chart URL for: ${title}`, "info");

    return `Chart generated successfully!

**${title}**

[CHART_IMAGE:${chartUrl}]`;
  } catch (error) {
    return `Chart generation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeGenerateChart(
  args: Record<string, unknown>,
): Promise<string> {
  const chartType = typeof args.chart_type === "string"
    ? args.chart_type
    : "line";
  const title = typeof args.title === "string" ? args.title : "Chart";
  const xLabel = typeof args.x_label === "string" ? args.x_label : "";
  const yLabel = typeof args.y_label === "string" ? args.y_label : "";
  const labels = Array.isArray(args.labels) ? args.labels : [];
  const datasets = Array.isArray(args.datasets) ? args.datasets : [];
  return await generateChart(
    chartType,
    title,
    xLabel,
    yLabel,
    labels,
    datasets,
  );
}
