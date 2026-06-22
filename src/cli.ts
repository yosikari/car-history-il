#!/usr/bin/env node
/**
 * CLI entry point.
 *
 *   vehicle-insight <plate> [--json|--html|--pdf] [--no-cache] [--out file]
 *
 * Examples:
 *   npm run report -- 5223563
 *   npm run report -- 5223563 --html --out report.html
 */
import { promises as fs } from "node:fs";
import { buildReport } from "./core/aggregator.js";
import { reportRequestSchema } from "./core/validate.js";
import { renderHtml, renderPdf } from "./report/html.js";

interface Args {
  plate?: string;
  format: "json" | "html" | "pdf";
  noCache: boolean;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { format: "json", noCache: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]!;
    if (t === "--json") a.format = "json";
    else if (t === "--html") a.format = "html";
    else if (t === "--pdf") a.format = "pdf";
    else if (t === "--no-cache") a.noCache = true;
    else if (t === "--out") a.out = argv[++i];
    else if (!t.startsWith("--")) a.plate = t;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.plate) {
    console.error("Usage: vehicle-insight <plate> [--json|--html|--pdf] [--no-cache] [--out file]");
    process.exit(2);
  }

  const parsed = reportRequestSchema.safeParse({ plate: args.plate });
  if (!parsed.success) {
    console.error("Invalid plate:", parsed.error.issues[0]?.message);
    process.exit(2);
  }

  const report = await buildReport(parsed.data, { noCache: args.noCache });

  let output: string | Uint8Array;
  if (args.format === "json") output = JSON.stringify(report, null, 2);
  else if (args.format === "html") output = renderHtml(report);
  else output = await renderPdf(report);

  if (args.out) {
    await fs.writeFile(args.out, output);
    console.error(`Wrote ${args.format} report for plate ${report.plate} → ${args.out}`);
  } else if (typeof output === "string") {
    process.stdout.write(output + "\n");
  } else {
    process.stdout.write(output);
  }

  if (report.classification.category === "unknown") {
    console.error(`\n[warn] vehicle not found in any registry. Warnings: ${report.warnings.join("; ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
