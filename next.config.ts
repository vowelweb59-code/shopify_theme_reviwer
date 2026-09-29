import type { NextConfig } from "next";

// Sent on every response. No script-src CSP yet: Next's inline bootstrap
// scripts would need nonces, and the report's print export uses an inline
// onclick; the directives below are the ones that are safe without that.
const SECURITY_HEADERS = [
  // Nobody may frame the app, so no clickjacking of Disconnect/Sync buttons.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The app shows no optimized images, so /_next/image (reachable without a
  // session) only adds attack surface.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
