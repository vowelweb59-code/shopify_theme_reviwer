import { afterEach, describe, expect, it, vi } from "vitest";
import { findThemeStoreRankings } from "./themeStoreRanking";

function cardHtml(entries: { baseSlug: string; presetSlug: string }[], page: number): string {
  return entries
    .map(
      (e, i) =>
        `<a href="/themes/${e.baseSlug}/presets/${e.presetSlug}?surface_inter_position=${page}&surface_intra_position=${i + 1}&surface_type=all">card</a>`
    )
    .join("\n");
}

// A pagination link that carries other query params too, in varying
// order — confirmed against a real filtered/sorted listing
// (`/themes?page=54&sort_by=newest`, page first) — as opposed to the
// bare `/themes?page=N` shape the unfiltered default view uses.
function pagerHtml(lastPage: number, extraQuery: string): string {
  return `<a href="/themes?page=${lastPage}${extraQuery}">${lastPage}</a>`;
}

describe("findThemeStoreRankings", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("finds a theme on a later page even when the pagination links carry extra query params (e.g. a sort filter)", async () => {
    // Regression test: an earlier version of extractLastPage only matched
    // the bare `/themes?page=N` shape, so any filtered/sorted crawl (whose
    // pagination links look like `/themes?page=N&sort_by=newest`) silently
    // read "1 page" and never found anything past page 1.
    const page1 = `${cardHtml([{ baseSlug: "other", presetSlug: "other" }], 1)}\n${pagerHtml(3, "&sort_by=newest")}`;
    const page2 = cardHtml([{ baseSlug: "other2", presetSlug: "other2" }], 2);
    const page3 = cardHtml([{ baseSlug: "gravity", presetSlug: "gravity" }], 3);

    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(url).searchParams.get("page");
      const html = page === "1" ? page1 : page === "2" ? page2 : page3;
      return { ok: true, text: async () => html } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await findThemeStoreRankings(new Map([["gravity", new Set(["gravity"])]]), { sortBy: "newest" });

    expect(results.get("gravity")).toEqual([{ presetSlug: "gravity", rank: 3, page: 3 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("finds a card whose link uses surface_type=industry instead of surface_type=all (an active Collection filter)", async () => {
    // Regression test: an earlier version of extractCatalogCards required
    // the literal string "surface_type=all" to recognize a card link, but
    // a real industry-filtered listing's cards use
    // `surface_type=industry&surface_detail=<slug>` instead (confirmed
    // live) — every industry-filtered crawl silently found zero cards on
    // every page as a result, reporting "no matches" for themes that were
    // actually there.
    const html =
      `<a href="/themes/radian/presets/radian?surface_detail=clothing&surface_inter_position=1&surface_intra_position=1&surface_type=industry">card</a>` +
      `<a href="/themes/gravity/presets/gravity?surface_detail=clothing&surface_inter_position=1&surface_intra_position=2&surface_type=industry">card</a>`;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => html }) as unknown as typeof fetch;

    const results = await findThemeStoreRankings(new Map([["gravity", new Set(["gravity"])]]), { industry: "clothing" });

    expect(results.get("gravity")).toEqual([{ presetSlug: "gravity", rank: 2, page: 1 }]);
  });

  it("stops after the single page when there's no pagination beyond it", async () => {
    const html = cardHtml([{ baseSlug: "adorn", presetSlug: "adorn" }], 1);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => html }) as unknown as typeof fetch;

    const results = await findThemeStoreRankings(new Map([["adorn", new Set(["adorn"])]]));

    expect(results.get("adorn")).toEqual([{ presetSlug: "adorn", rank: 1, page: 1 }]);
  });
});
