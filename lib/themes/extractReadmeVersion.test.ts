import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractVersionFromReadmeText, extractVersionFromSettingsSchema, findReadmeFile } from "./extractReadmeVersion";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function makeThemeDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readme-version-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf-8");
  }
  cleanup = () => fs.rmSync(root, { recursive: true, force: true });
  return root;
}

describe("extractVersionFromReadmeText", () => {
  it("extracts the version from the user's exact convention", () => {
    expect(extractVersionFromReadmeText("Version: 2.4.1")).toEqual({ version: "2.4.1" });
  });

  it("is case-insensitive and tolerant of extra whitespace", () => {
    expect(extractVersionFromReadmeText("  VERSION  :   1.0.0  ")).toEqual({ version: "1.0.0" });
  });

  it("strips a leading v prefix from the captured version", () => {
    expect(extractVersionFromReadmeText("Version: v3.2.1")).toEqual({ version: "3.2.1" });
  });

  it("matches the first version line in a changelog-style README", () => {
    const text = ["# Adorn", "", "Version: 2.4.1", "", "## Changelog", "Version: 2.4.0", "Version: 2.3.2"].join("\n");
    expect(extractVersionFromReadmeText(text)).toEqual({ version: "2.4.1" });
  });

  it("returns null when there is no version line at all", () => {
    expect(extractVersionFromReadmeText("# Adorn\n\nA clean, modern Shopify theme.")).toBeNull();
  });

  it("does not match a bare number that isn't labeled as a version", () => {
    expect(extractVersionFromReadmeText("Supports Shopify 2.0 sections.")).toBeNull();
  });

  it("supports a pre-release/build suffix", () => {
    expect(extractVersionFromReadmeText("Version: 2.4.1-beta.1")).toEqual({ version: "2.4.1-beta.1" });
  });
});

describe("findReadmeFile", () => {
  it("finds README.md", () => {
    const root = makeThemeDir({ "README.md": "Version: 1.0.0" });
    const readme = findReadmeFile(root);
    expect(readme).toEqual({ filename: "README.md", content: "Version: 1.0.0" });
  });

  it("finds a lowercase readme.txt", () => {
    const root = makeThemeDir({ "readme.txt": "Version: 1.0.0" });
    expect(findReadmeFile(root)?.filename).toBe("readme.txt");
  });

  it("finds an extensionless README", () => {
    const root = makeThemeDir({ README: "Version: 1.0.0" });
    expect(findReadmeFile(root)?.filename).toBe("README");
  });

  it("returns null when no README exists", () => {
    const root = makeThemeDir({ "config/settings_schema.json": "[]" });
    expect(findReadmeFile(root)).toBeNull();
  });

  it("does not look inside subdirectories", () => {
    const root = makeThemeDir({ "docs/README.md": "Version: 1.0.0" });
    expect(findReadmeFile(root)).toBeNull();
  });
});

describe("extractVersionFromSettingsSchema", () => {
  function settingsSchema(entries: unknown[]): string {
    return JSON.stringify(entries);
  }

  it("extracts theme_version from the theme_info entry", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([{ name: "theme_info", theme_version: "15.4.0" }]),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "15.4.0" });
  });

  it("strips a leading v prefix", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([{ name: "theme_info", theme_version: "v2.4.1" }]),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "2.4.1" });
  });

  it("finds theme_info regardless of its position in the array", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([
        { name: "colors", settings: [] },
        { name: "theme_info", theme_version: "1.2.3" },
      ]),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "1.2.3" });
  });

  it("returns null when the file doesn't exist", () => {
    const root = makeThemeDir({});
    expect(extractVersionFromSettingsSchema(root)).toBeNull();
  });

  it("returns null when there is no theme_info entry", () => {
    const root = makeThemeDir({ "config/settings_schema.json": settingsSchema([{ name: "colors" }]) });
    expect(extractVersionFromSettingsSchema(root)).toBeNull();
  });

  it("returns null when theme_version is missing or not a version-shaped string", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([{ name: "theme_info" }]),
    });
    expect(extractVersionFromSettingsSchema(root)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const root = makeThemeDir({ "config/settings_schema.json": "{ not valid json" });
    expect(extractVersionFromSettingsSchema(root)).toBeNull();
  });

  it("returns null when the JSON is not an array", () => {
    const root = makeThemeDir({ "config/settings_schema.json": JSON.stringify({ name: "theme_info" }) });
    expect(extractVersionFromSettingsSchema(root)).toBeNull();
  });

  it("tolerates a trailing comma before a closing bracket (real-world Adorn theme shape)", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": [
        "[",
        '  { "name": "theme_info", "theme_version": "2.3.6" },',
        '  { "name": "colors", "settings": [',
        '    { "type": "color", "id": "body_bg" },',
        "  ] },",
        "]",
      ].join("\n"),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "2.3.6" });
  });

  it("does not strip a comma that appears inside a string value", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([{ name: "theme_info", theme_version: "1.0.0", theme_author: "A, B" }]),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "1.0.0" });
  });

  it("tolerates a //-commented-out block left in as disabled documentation (real-world Gravity theme shape)", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": [
        "[",
        '  { "name": "theme_info", "theme_version": "1.1.6" },',
        '  { "name": "colors", "settings": [',
        '    { "type": "color", "id": "body_bg" }',
        "  ] },",
        "  // {",
        '  //   "name": "Gift wrapping",',
        "  //   \"settings\": [",
        "  //     { \"type\": \"checkbox\", \"id\": \"enable_gift_wrapping\" }",
        "  //   ]",
        "  // },",
        "]",
      ].join("\n"),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "1.1.6" });
  });

  it("does not treat // inside a string value (e.g. a URL) as a comment", () => {
    const root = makeThemeDir({
      "config/settings_schema.json": settingsSchema([
        { name: "theme_info", theme_version: "1.1.6", theme_documentation_url: "https://example.com/docs/" },
      ]),
    });
    expect(extractVersionFromSettingsSchema(root)).toEqual({ version: "1.1.6" });
  });
});
