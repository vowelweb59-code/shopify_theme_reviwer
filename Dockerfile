# Plain Node images: nothing in the app needs a browser any more (PDF export
# is the report page printed by the user's own browser), so the old
# Playwright base image — ~4 GB of Chromium/Firefox/WebKit and their OS
# libraries — is gone.
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next's standalone output (next.config.ts): a minimal server.js plus only
# the node_modules files the server actually uses. Static assets and
# public/ aren't included in it by design, so they're copied alongside.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
