import { describe, expect, it } from "vitest";
import { MAX_INSTALL_DIMENSIONS, pickInstallDimensions } from "./installDimensions";

describe("pickInstallDimensions", () => {
  it("keeps only custom event parameters, relevant ones first, labelled by their GA4 name", () => {
    const picked = pickInstallDimensions([
      { apiName: "country", uiName: "Country" },
      { apiName: "customEvent:app_version", uiName: "App version" },
      { apiName: "customEvent:store_url", uiName: "Store URL" },
      { apiName: "customUser:plan", uiName: "Plan" },
      { apiName: "customEvent:store_title", uiName: "" },
    ]);
    expect(picked).toEqual([
      { apiName: "customEvent:store_url", label: "Store URL" },
      { apiName: "customEvent:store_title", label: "store_title" },
      { apiName: "customEvent:app_version", label: "App version" },
    ]);
  });

  it("is empty when no custom event parameter is registered", () => {
    expect(pickInstallDimensions([{ apiName: "city", uiName: "City" }])).toEqual([]);
  });

  it("never returns more than a report can take", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ apiName: `customEvent:p${i}`, uiName: `P${i}` }));
    expect(pickInstallDimensions(many)).toHaveLength(MAX_INSTALL_DIMENSIONS);
  });
});
