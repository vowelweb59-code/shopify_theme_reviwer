import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next resolves "server-only" itself (it's a build-time guard against
      // importing server code into client components); plain Node can't.
      "server-only": `${import.meta.dirname}/test/server-only-stub.ts`,
    },
  },
  test: {
    environment: "node",
  },
});
