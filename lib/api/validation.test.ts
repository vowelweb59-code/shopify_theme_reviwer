import { describe, expect, it } from "vitest";
import { isValidObjectId } from "./validation";

describe("isValidObjectId", () => {
  it("accepts a real ObjectId string", () => {
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("rejects a non-ObjectId string", () => {
    expect(isValidObjectId("not-a-valid-id")).toBe(false);
  });

  it("rejects null, undefined, and empty string", () => {
    expect(isValidObjectId(null)).toBe(false);
    expect(isValidObjectId(undefined)).toBe(false);
    expect(isValidObjectId("")).toBe(false);
  });
});
