import { describe, expect, it } from "vitest";
import { liveProjectsOf } from "./attribution";

const p = (id: string, clientId: string | null, status: string) => ({ id, clientId, status });

describe("liveProjectsOf", () => {
  it("leaves out a closed project when the client has an open one", () => {
    expect(liveProjectsOf([p("old", "c", "COMPLETED"), p("new", "c", "ACTIVE")]).map((x) => x.id)).toEqual(["new"]);
  });
  it("keeps a client's closed projects when none is open", () => {
    expect(liveProjectsOf([p("a", "c", "COMPLETED"), p("b", "c", "CANCELLED")]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("keeps several open projects and other clients' closed ones", () => {
    expect(liveProjectsOf([p("a", "c", "ACTIVE"), p("b", "c", "ON_HOLD"), p("z", "d", "COMPLETED")]).map((x) => x.id)).toEqual(["a", "b", "z"]);
  });
});
