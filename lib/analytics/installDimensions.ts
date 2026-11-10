// Which of a GA4 property's custom event parameters to show next to each theme install. The install event
// (shopify_theme_install) carries details about the store that installed (its URL, its title); GA4 only returns an event
// parameter through the Data API when it is registered as a custom dimension, and the registered names are the owner's, so they
// are read from the property's own metadata rather than hard-coded here. Pure.

export type MetadataDimension = { apiName: string; uiName: string };
export type InstallDimension = { apiName: string; label: string };

/** Parameters that describe the installing store, or the theme, ahead of the rest. */
const RELEVANT = /store|shop|domain|url|title|name|theme|preset|merchant|plan|email|country/i;
/** A report takes at most 9 dimensions; one is the date. */
export const MAX_INSTALL_DIMENSIONS = 8;

/** Custom event-scoped dimensions only (`customEvent:<parameter>`), the likely-relevant ones first, at most MAX_INSTALL_DIMENSIONS. */
export function pickInstallDimensions(all: MetadataDimension[]): InstallDimension[] {
  const custom = all.filter((d) => d.apiName.startsWith("customEvent:"));
  const relevant = custom.filter((d) => RELEVANT.test(d.apiName) || RELEVANT.test(d.uiName));
  const rest = custom.filter((d) => !relevant.includes(d));
  return [...relevant, ...rest].slice(0, MAX_INSTALL_DIMENSIONS).map((d) => ({ apiName: d.apiName, label: d.uiName || d.apiName.replace("customEvent:", "") }));
}
