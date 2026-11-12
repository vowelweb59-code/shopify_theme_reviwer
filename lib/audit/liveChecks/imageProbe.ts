import { fetchPublicBytes } from "@/lib/net/publicUrl";
import type { DemoContent } from "./demoContent";
import { contentImagesOf, imageKey } from "./demoRealism";
import { imageSizeFromBytes } from "./imageSize";
import { mapWithConcurrency } from "./shared";

export type ImageProbe = { src: string; status: number; width: number | null; height: number | null };

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_CONCURRENCY = 3;

/** The full-size file behind a responsive URL: Shopify's width/height/crop query and old-style `_600x` file suffixes removed. */
export function originalImageUrl(src: string): string {
  try {
    const u = new URL(src);
    for (const key of ["width", "height", "crop", "pad_color", "format"]) u.searchParams.delete(key);
    u.pathname = u.pathname.replace(/_(\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande)(?=\.[a-z]+$)/i, "");
    return u.toString();
  } catch {
    return src;
  }
}

/**
 * Reads the first 64 KB of up to `max` distinct photos on a page (the first ones in the page, so hero images come first) to learn
 * whether each loads and how many pixels wide it really is. An image that can't be reached at all is skipped, not reported:
 * only a definite answer (404/410, or a readable size) becomes evidence.
 */
export async function probeImages(content: DemoContent, max = 6): Promise<ImageProbe[]> {
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const image of contentImagesOf(content)) {
    const key = imageKey(image.src);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(originalImageUrl(image.src));
    if (picks.length >= max) break;
  }
  const results = await mapWithConcurrency(picks, PROBE_CONCURRENCY, async (src): Promise<ImageProbe | null> => {
    try {
      const { status, bytes } = await fetchPublicBytes(src, { timeoutMs: PROBE_TIMEOUT_MS });
      const size = bytes.length > 0 ? imageSizeFromBytes(bytes) : null;
      return { src, status, width: size?.width ?? null, height: size?.height ?? null };
    } catch {
      return null;
    }
  });
  return results.filter((r): r is ImageProbe => r !== null);
}
