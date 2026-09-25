import { describe, expect, it, vi } from "vitest";
import { getPropertyDetails, listAccessibleProperties, toPropertyError, type AdminApi } from "./properties";
import { normalizePropertyId, slugify } from "./themes";

const httpError = (status: number, message = "") => Object.assign(new Error(message), { status });

function fakeAdmin({ pages = [], property, error }: { pages?: unknown[]; property?: unknown; error?: Error }): AdminApi {
  let page = 0;
  return {
    accountSummaries: {
      list: vi.fn(async () => {
        if (error) throw error;
        return { data: pages[page++] };
      }),
    },
    properties: {
      get: vi.fn(async () => {
        if (error) throw error;
        return { data: property };
      }),
    },
  } as unknown as AdminApi;
}

describe("listAccessibleProperties", () => {
  it("flattens every account's properties across pages, sorted by account then name", async () => {
    const admin = fakeAdmin({
      pages: [
        {
          accountSummaries: [
            {
              account: "accounts/2",
              displayName: "Zeta Themes",
              propertySummaries: [{ property: "properties/222", displayName: "Zeal", propertyType: "PROPERTY_TYPE_ORDINARY" }],
            },
          ],
          nextPageToken: "p2",
        },
        {
          accountSummaries: [
            {
              account: "accounts/1",
              displayName: "Alpha Themes",
              propertySummaries: [
                { property: "properties/112", displayName: "Noble", propertyType: "PROPERTY_TYPE_ORDINARY" },
                { property: "properties/111", displayName: "Adorn" },
                { property: "properties/999", displayName: "Roll-up", propertyType: "PROPERTY_TYPE_ROLLUP" },
              ],
            },
          ],
        },
      ],
    });

    const properties = await listAccessibleProperties(admin);
    expect(properties).toEqual([
      { propertyId: "111", displayName: "Adorn", accountId: "1", accountDisplayName: "Alpha Themes" },
      { propertyId: "112", displayName: "Noble", accountId: "1", accountDisplayName: "Alpha Themes" },
      { propertyId: "222", displayName: "Zeal", accountId: "2", accountDisplayName: "Zeta Themes" },
    ]);
    expect(admin.accountSummaries.list).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list for an account with no GA4 access", async () => {
    expect(await listAccessibleProperties(fakeAdmin({ pages: [{}] }))).toEqual([]);
  });
});

describe("getPropertyDetails", () => {
  it("returns the property's name, time zone and creation date", async () => {
    const admin = fakeAdmin({ property: { name: "properties/111", displayName: "Adorn Demo", timeZone: "Asia/Kolkata", createTime: "2023-04-01T10:00:00Z" } });
    expect(await getPropertyDetails(admin, "111")).toEqual({ propertyId: "111", displayName: "Adorn Demo", timeZone: "Asia/Kolkata", createTime: "2023-04-01T10:00:00Z" });
    expect(admin.properties.get).toHaveBeenCalledWith({ name: "properties/111" });
  });

  it("treats a trashed property as not found", async () => {
    await expect(getPropertyDetails(fakeAdmin({ property: { displayName: "Old", deleteTime: "2026-01-01T00:00:00Z" } }), "111")).rejects.toMatchObject({ code: "not_found" });
  });

  it("maps a permission failure", async () => {
    await expect(getPropertyDetails(fakeAdmin({ error: httpError(403, "User does not have sufficient permissions for this property.") }), "111")).rejects.toMatchObject({
      code: "permission_denied",
    });
  });
});

describe("toPropertyError", () => {
  it("distinguishes a disabled Admin API from a permission problem", () => {
    expect(toPropertyError(httpError(403, "Google Analytics Admin API has not been used in project 123 before or it is disabled.")).code).toBe("api_disabled");
    expect(toPropertyError(httpError(403, "PERMISSION_DENIED")).code).toBe("permission_denied");
  });

  it("maps revoked tokens, missing properties and outages", () => {
    expect(toPropertyError(Object.assign(new Error(), { response: { data: { error: "invalid_grant" } } })).code).toBe("auth_revoked");
    expect(toPropertyError(httpError(401)).code).toBe("auth_revoked");
    expect(toPropertyError(httpError(404), "111").message).toContain("111");
    expect(toPropertyError(httpError(503)).code).toBe("unavailable");
    expect(toPropertyError(new Error("ETIMEDOUT")).code).toBe("unavailable");
  });

  it("never echoes Google's raw error text to the user", () => {
    const err = toPropertyError(httpError(403, "internal detail: token ya29.secret"));
    expect(err.message).not.toContain("ya29");
  });
});

describe("theme input helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Adorn")).toBe("adorn");
    expect(slugify("  Café Noir  2 ")).toBe("cafe-noir-2");
    expect(slugify("!!!")).toBe("");
  });

  it("accepts both property id forms and rejects junk", () => {
    expect(normalizePropertyId("123456789")).toBe("123456789");
    expect(normalizePropertyId(" properties/123456789 ")).toBe("123456789");
    expect(normalizePropertyId("G-ABC123")).toBeNull();
    expect(normalizePropertyId(123456789)).toBeNull();
  });
});
