import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately NOT output: "standalone" — its file-tracer only follows
  // static imports, so it misses Playwright's runtime-loaded, non-code
  // assets (e.g. playwright-core's browsers.json), which PDF export
  // (lib/export/pdf.ts, the only remaining Playwright/Chromium usage —
  // live checks and PageSpeed were migrated off Chromium to fetch()/the
  // PageSpeed Insights API) depends on. Confirmed by testing the built
  // Docker image directly: standalone output crashed with "Cannot find
  // module '.../playwright-core/browsers.json'" the moment a Chromium-
  // dependent code path ran. The Dockerfile copies the full node_modules
  // instead — simpler and correct, at the cost of a larger image, which
  // matters far less than reliability for an internal tool.
};

export default nextConfig;
