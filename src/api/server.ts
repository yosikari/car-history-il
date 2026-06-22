/**
 * HTTP API (request-handling layer).
 *
 *   GET /health                      → liveness
 *   GET /api/vehicle/:plate          → Unified Vehicle Report (JSON)
 *   GET /api/vehicle/:plate/report   → printable HTML report
 *   GET /api/vehicle/:plate/pdf      → PDF (requires Playwright)
 *
 * Query params: ?ownerId=&ownershipDate=&noCache=true
 * Input is validated with zod; invalid plates return 400, not found returns 404.
 */
import path from "node:path";
import express from "express";
import { buildReport } from "../core/aggregator.js";
import { reportRequestSchema } from "../core/validate.js";
import { renderHtml, renderPdf } from "../report/html.js";

/**
 * Built SPA assets (web/ → public/). The directory lives at the project root
 * regardless of whether we run from src/ (tsx) or dist/ (compiled), so resolve
 * it from the working directory. Override with PUBLIC_DIR if needed.
 */
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR ?? path.join(process.cwd(), "public"));

export function createServer() {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  const handler = (mode: "json" | "html" | "pdf") =>
    async (req: express.Request, res: express.Response) => {
      const parsed = reportRequestSchema.safeParse({
        plate: req.params.plate,
        ownerId: req.query.ownerId,
        ownershipDate: req.query.ownershipDate,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      }
      try {
        const report = await buildReport(parsed.data, {
          noCache: req.query.noCache === "true",
        });
        if (report.classification.category === "unknown") {
          return res.status(404).json({ error: "vehicle_not_found", plate: report.plate, warnings: report.warnings });
        }
        if (mode === "json") return res.json(report);
        if (mode === "html") {
          res.type("html").send(renderHtml(report));
          return;
        }
        const pdf = await renderPdf(report);
        res.type("application/pdf").send(Buffer.from(pdf));
      } catch (e) {
        res.status(502).json({ error: "upstream_failure", message: (e as Error).message });
      }
    };

  app.get("/api/vehicle/:plate", handler("json"));
  app.get("/api/vehicle/:plate/report", handler("html"));
  app.get("/api/vehicle/:plate/pdf", handler("pdf"));

  // Serve the built CarHistoryIL SPA (if present) and fall back to index.html for
  // client-side routes. API/health routes above always take precedence.
  app.use(express.static(PUBLIC_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(PUBLIC_DIR, "index.html"), (err) => {
      if (err) res.status(404).json({ error: "frontend_not_built", hint: "run: npm run web:build" });
    });
  });

  return app;
}

// Start when run directly.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.ts")) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => {
    console.log(`Vehicle Insight Engine listening on http://localhost:${port}`);
  });
}
