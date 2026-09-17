import type { ThemeZipDoc } from "@/models/theme-zip";
import { readZipBuffer } from "./zipStorage";

/**
 * The seam a future Git integration plugs into (spec §8) — the audit
 * engine only ever needs a zip buffer, regardless of where it came from.
 * Adding a real GitSource later means implementing getZipBuffer() for it
 * (clone/export a ref into a buffer) and calling the exact same
 * executeAuditRun(buffer, ...) — no change to the engine or to
 * executeAuditRun itself, which already just takes a Buffer.
 */
export type ThemeSource = {
  kind: "local_upload";
  getZipBuffer(): Promise<Buffer>;
};

export function localUploadSource(themeZip: Pick<ThemeZipDoc, "gridFsFileId">): ThemeSource {
  return {
    kind: "local_upload",
    getZipBuffer: () => readZipBuffer(themeZip.gridFsFileId as unknown as string),
  };
}

// Future (not implemented — no Git functionality exists yet):
// export type GitThemeSource = { kind: "git"; ref: string; getZipBuffer(): Promise<Buffer> };
