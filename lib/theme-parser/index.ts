import fs from "node:fs";
import { extractCssStructure } from "./extractCssStructure";
import { extractHtmlStructure } from "./extractHtmlStructure";
import { extractLiquidStructure } from "./extractLiquidStructure";
import { parseJsonFile } from "./parseJsonFile";
import { emptyParsedFile, type FileType, type ParsedFile } from "./types";
import { resolveThemeRoot } from "./validateThemeStructure";
import { extractThemeZip } from "./zip";
import { walkThemeFiles } from "./walkFiles";

export { ThemeZipError } from "./zip";
export { InvalidThemeError } from "./validateThemeStructure";
export * from "./types";

export type ThemeParseResult = {
  files: ParsedFile[];
  fileStats: Record<FileType, number>;
  skippedFileCount: number;
  fileErrors: { path: string; error: string }[];
};

function parseOneFile(relativePath: string, fileType: FileType, rawText: string): ParsedFile {
  const parsedFile = emptyParsedFile(relativePath, fileType, rawText);

  if (fileType === "liquid") {
    const html = extractHtmlStructure(rawText);
    const liquid = extractLiquidStructure(rawText);
    Object.assign(parsedFile, html, liquid);
    parsedFile.parseErrors = [...html.parseErrors, ...liquid.parseErrors];
  } else if (fileType === "json") {
    parsedFile.jsonInfo = parseJsonFile(relativePath, rawText);
    parsedFile.sectionReferences = parsedFile.jsonInfo.sectionReferences;
    if (parsedFile.jsonInfo.parseError) {
      parsedFile.parseErrors = [{ message: `Invalid JSON: ${parsedFile.jsonInfo.parseError}` }];
    }
  } else if (fileType === "css") {
    const { cssInfo, parseErrors } = extractCssStructure(rawText);
    parsedFile.cssInfo = cssInfo;
    parsedFile.parseErrors = parseErrors;
  }
  // fileType === "js": Phase 2 only records the file's existence/content;
  // JS-specific structural checks are a Phase 3/4 concern (see phase-3/4 docs).

  return parsedFile;
}

/**
 * Full pipeline: theme ZIP buffer -> extracted+validated temp dir -> ParsedFile[].
 * Always cleans up the temp extraction directory, even on failure.
 */
export async function parseThemeZip(zipBuffer: Buffer): Promise<ThemeParseResult> {
  const { dir, cleanup } = await extractThemeZip(zipBuffer);
  try {
    const themeRoot = resolveThemeRoot(dir);
    return parseThemeDirectory(themeRoot);
  } finally {
    await cleanup();
  }
}

export function parseThemeDirectory(themeRoot: string): ThemeParseResult {
  const { files: discovered, skippedCount } = walkThemeFiles(themeRoot);

  const files: ParsedFile[] = [];
  const fileErrors: { path: string; error: string }[] = [];
  const fileStats: Record<FileType, number> = { liquid: 0, json: 0, css: 0, js: 0 };

  for (const { absolutePath, relativePath, fileType } of discovered) {
    try {
      const rawText = fs.readFileSync(absolutePath, "utf-8");
      const parsedFile = parseOneFile(relativePath, fileType, rawText);
      files.push(parsedFile);
      fileStats[fileType]++;
    } catch (err) {
      // A single unreadable/unparseable file must not stop the whole audit.
      fileErrors.push({ path: relativePath, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { files, fileStats, skippedFileCount: skippedCount, fileErrors };
}
