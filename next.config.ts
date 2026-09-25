import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: `next build` traces exactly the files the server
  // needs into .next/standalone, so the Docker image ships a minimal
  // server.js + traced node_modules instead of the whole dependency tree.
  // (This used to be off because Playwright's runtime-loaded assets weren't
  // traceable; PDF export no longer uses Chromium, so nothing needs that.)
  output: "standalone",
  // The theme parser's postcss is otherwise loaded as an external module
  // through a hashed link that standalone output doesn't create (Next ships
  // its own, different postcss version), so audits crashed with "Cannot find
  // module .../postcss-<hash>". Bundling it avoids the external entirely.
  transpilePackages: ["postcss"],
  // The theme parser reads extracted ZIPs from a temp dir via dynamic fs
  // paths, which the tracer can't resolve, so it conservatively copies the
  // whole project into those routes' output. None of this is read at
  // runtime (source is compiled into .next; data/ is seed-only), so leave
  // it out.
  outputFileTracingExcludes: {
    "*": [
      "./*.{md,pdf,png,xlsx}",
      "./graphify-out/**",
      "./app/**",
      "./lib/**",
      "./models/**",
      "./scripts/**",
      "./test/**",
      "./data/**",
      "./.git/**",
      "./tsconfig.tsbuildinfo",
    ],
  },
};

export default nextConfig;
