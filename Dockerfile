# Both stages use Playwright's own base image (not plain node) — it ships
# Chromium's OS-level shared libraries already installed, which a plain
# node:20 image doesn't have and getting right by hand (apt-get list of
# ~20 packages) is easy to get subtly wrong. Keep this tag's version in
# sync with the `playwright` version in package.json.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# The full node_modules, not next.config.ts's standalone-trace output —
# Playwright needs non-code runtime assets (browsers.json, its bundled
# browser binaries) that Next.js's static-import file tracer doesn't know
# to include, confirmed by testing the standalone build directly (it
# crashed the moment a live check tried to launch Chromium).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "run", "start"]
