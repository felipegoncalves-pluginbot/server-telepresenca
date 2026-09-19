import cors from "cors";
import express from "express";
import { proxyInvite } from "./invite-proxy.js";

/**
 * @param {object} options
 * @param {string} options.publicDir
 * @param {unknown[]} options.iceServers
 * @param {string | string[]} [options.corsOrigin]
 * @param {string} [options.robotsApiUrl]
 */
export function createApp({
  publicDir,
  iceServers,
  corsOrigin = "*",
  robotsApiUrl = "",
}) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "32kb" }));
  app.use(
    express.static(publicDir, {
      etag: false,
      maxAge: 0,
      setHeaders: (res, path) => {
        if (path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "telepresenca-signaling" });
  });

  app.get("/ice-servers", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ iceServers });
  });

  app.get("/config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ robotsApiUrl: robotsApiUrl || "" });
  });

  async function forwardInvite(req, res, suffix = "") {
    if (!robotsApiUrl) {
      res.status(503).json({
        code: "invite_missing_api",
        error: "ROBOTS_API_URL is not configured",
      });
      return;
    }
    try {
      const result = await proxyInvite({
        robotsApiUrl,
        inviteId: req.params.id,
        suffix,
        method: req.method,
        body: req.method === "POST" ? JSON.stringify(req.body || {}) : "",
      });
      res.status(result.status).type("json").send(result.body);
    } catch {
      res.status(502).json({ code: "invite_unavailable" });
    }
  }

  app.get("/invite-session/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return forwardInvite(req, res);
  });

  app.post("/invite-session/:id/join", (req, res) => forwardInvite(req, res, "/join"));

  return app;
}
