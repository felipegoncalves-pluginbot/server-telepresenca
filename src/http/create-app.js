import cors from "cors";
import express from "express";

/**
 * @param {object} options
 * @param {string} options.publicDir
 * @param {unknown[]} options.iceServers
 * @param {string | string[]} [options.corsOrigin]
 */
export function createApp({ publicDir, iceServers, corsOrigin = "*" }) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
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

  return app;
}
