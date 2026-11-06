/** Back to the Google Ads tab, which shows the outcome. Prefers APP_URL over the request origin (behind a proxy the latter can be internal). */
export function adsReturnUrl(requestUrl: string, params: Record<string, string>): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "") || new URL(requestUrl).origin;
  const url = new URL("/demo-store", base);
  url.searchParams.set("tab", "ads");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}
