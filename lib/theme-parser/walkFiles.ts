import fs from "node:fs";
import path from "node:path";
import type { FileType } from "./types";

export type DiscoveredFile = {
  absolutePath: string;
  relativePath: string; // POSIX-style, relative to the theme root
  fileType: FileType;
};

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  ".liquid": "liquid",
  ".json": "json",
  ".css": "css",
  ".scss": "css", // not a valid Theme Store submission format, but still parsed so Phase 3 can flag it
  ".js": "js",
};

/** Recursively walks the theme root, classifying supported files and counting (not collecting) everything else. */
export function walkThemeFiles(themeRoot: string): { files: DiscoveredFile[]; skippedCount: number } {
  const files: DiscoveredFile[] = [];
  let skippedCount = 0;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue; // .git, .DS_Store, etc. — never part of a theme package
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const fileType = EXTENSION_TO_TYPE[ext];
      if (!fileType) {
        skippedCount++;
        continue;
      }

      const relativePath = path.relative(themeRoot, absolutePath).split(path.sep).join("/");
      files.push({ absolutePath, relativePath, fileType });
    }
  }

  walk(themeRoot);
  return { files, skippedCount };
}
