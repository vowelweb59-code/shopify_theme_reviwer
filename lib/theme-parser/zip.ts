import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yauzl from "yauzl";

// Theme ZIPs are untrusted input. yauzl is used (rather than adm-zip, which
// has had path-traversal CVEs) and every entry is independently checked
// against these limits before a single byte is written to disk.
export const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200MB compressed upload
export const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // archive-bomb guard
export const MAX_FILE_COUNT = 20_000;
export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

export class ThemeZipError extends Error {}

export type ExtractedTheme = {
  dir: string;
  cleanup: () => Promise<void>;
};

/** Resolves an entry's on-disk destination, rejecting anything that would land outside `targetDir`. */
function safeEntryPath(targetDir: string, entryName: string): string | null {
  if (path.isAbsolute(entryName) || entryName.includes("\0")) return null;
  const resolved = path.resolve(targetDir, entryName);
  if (resolved !== targetDir && !resolved.startsWith(targetDir + path.sep)) return null;
  return resolved;
}

function extractEntries(buffer: Buffer, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        reject(new ThemeZipError(`Could not open zip: ${openErr?.message ?? "unknown error"}`));
        return;
      }

      let fileCount = 0;
      let totalUncompressed = 0;
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        reject(err);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      zipfile.on("error", (err) => fail(new ThemeZipError(`Malformed zip archive: ${err.message}`)));
      zipfile.on("end", finish);

      zipfile.on("entry", (entry) => {
        fileCount++;
        if (fileCount > MAX_FILE_COUNT) {
          fail(new ThemeZipError(`Zip contains more than ${MAX_FILE_COUNT} entries — rejected.`));
          return;
        }

        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
          fail(new ThemeZipError(`Zip would extract to more than ${MAX_UNCOMPRESSED_BYTES} bytes — rejected (archive-bomb protection).`));
          return;
        }
        if (entry.uncompressedSize > MAX_SINGLE_FILE_BYTES) {
          fail(new ThemeZipError(`Entry "${entry.fileName}" exceeds the per-file size limit — rejected.`));
          return;
        }

        const destPath = safeEntryPath(targetDir, entry.fileName);
        if (!destPath) {
          fail(new ThemeZipError(`Zip entry "${entry.fileName}" resolves outside the extraction directory — rejected (path traversal).`));
          return;
        }

        const isDirEntry = /[/\\]$/.test(entry.fileName);
        if (isDirEntry) {
          fs.mkdir(destPath, { recursive: true }, (mkErr) => {
            if (mkErr) return fail(mkErr);
            zipfile.readEntry();
          });
          return;
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) return fail(streamErr ?? new Error("Failed to open entry stream"));
          fs.mkdir(path.dirname(destPath), { recursive: true }, (mkErr) => {
            if (mkErr) return fail(mkErr);
            const writeStream = fs.createWriteStream(destPath);
            readStream.on("error", fail);
            writeStream.on("error", fail);
            writeStream.on("close", () => zipfile.readEntry());
            readStream.pipe(writeStream);
          });
        });
      });

      zipfile.readEntry();
    });
  });
}

/** Extracts a theme ZIP to a fresh temp directory. Caller must call `cleanup()` (e.g. in a `finally`) once done. */
export async function extractThemeZip(buffer: Buffer): Promise<ExtractedTheme> {
  if (buffer.length === 0) throw new ThemeZipError("Uploaded file is empty.");
  if (buffer.length > MAX_ZIP_BYTES) {
    throw new ThemeZipError(`Zip file is ${buffer.length} bytes, exceeding the ${MAX_ZIP_BYTES}-byte limit.`);
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shopify-theme-audit-"));
  const cleanup = () => fs.promises.rm(tempDir, { recursive: true, force: true });

  try {
    await extractEntries(buffer, tempDir);
  } catch (err) {
    await cleanup().catch(() => {});
    throw err;
  }

  return { dir: tempDir, cleanup };
}
