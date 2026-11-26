import { describe, expect, it } from "vitest";
import { clientOf, matchSpacesToProjects, nameScore } from "./space-match";

describe("nameScore", () => {
  it("takes the client part of a project name", () => {
    expect(clientOf("Ledty LavishCo – Batul")).toBe("Ledty LavishCo");
    expect(clientOf("Pramesh Baskota")).toBe("Pramesh Baskota");
    expect(clientOf("Jasmine Owyang – Huzefa Kapadia")).toBe("Jasmine Owyang");
  });

  it("scores exact, contained and partial names", () => {
    expect(nameScore("Pramesh Baskota", "Pramesh Baskota")).toBe(100);
    expect(nameScore("DM | Pramesh Baskota | Ashfaque", "Pramesh Baskota")).toBe(90);
    expect(nameScore("Baskota", "Pramesh Baskota")).toBe(0); // one word of two is not enough
    expect(nameScore("Eleanor", "Eleanor Jenkins")).toBe(0);
    expect(nameScore("Warwick Jewelry Store", "Warwick")).toBe(75);
    expect(nameScore("Warwick Team Chat", "Warwick")).toBe(100); // "team" and "chat" are ignored words
    expect(nameScore("Ledty Lavish Weekly", "Ledty LavishCo – Batul")).toBe(0);
  });

  it("ignores case, accents and company suffixes", () => {
    expect(nameScore("ELEANOR  jenkins", "Eleanor Jenkins")).toBe(100);
    expect(nameScore("Ateeq Chowdhrie LLC", "Ateeq Chowdhrie – Batul")).toBe(100);
  });
});

describe("matchSpacesToProjects", () => {
  const spaces = [
    { name: "spaces/A", displayName: "Divya Joshi" },
    { name: "spaces/B", displayName: "Weekly standup" },
    { name: "spaces/C", displayName: "Divya Joshi - SEO" },
  ];
  const projects = [
    { id: "p1", name: "Divya Joshi" },
    { id: "p2", name: "Brian Denton" },
  ];

  it("lists the best space first and leaves a project with none empty", () => {
    const [a, b] = matchSpacesToProjects(spaces, projects);
    expect(a.candidates.map((c) => c.name)).toEqual(["spaces/A", "spaces/C"]);
    expect(b.candidates).toEqual([]);
  });
});
