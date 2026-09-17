import type { Types } from "mongoose";
import { ThemeVersion } from "@/models/theme-version";
import { ThemeZip } from "@/models/theme-zip";
import { extractThemeVersionFromZip } from "./extractReadmeVersion";
import { parseVersionForSort } from "./compareVersions";
import { storeZipBuffer } from "./zipStorage";
import { sha256 } from "./checksum";

export type UploadVersionResult =
  | { ok: true; themeVersion: InstanceType<typeof ThemeVersion>; themeZip: InstanceType<typeof ThemeZip>; reusedZip: boolean }
  | { ok: false; error: string };

function readmeErrorMessage(result: Extract<Awaited<ReturnType<typeof extractThemeVersionFromZip>>, { ok: false }>): string {
  switch (result.reason) {
    case "readme_not_found":
      return "No README file was found in this theme ZIP. The version can't be determined without one — add a README with a \"Version: x.y.z\" line and re-upload.";
    case "version_not_found":
      return `Found ${result.readmeFilename}, but no "Version: x.y.z" line could be found in it. Add one and re-upload — the version is never guessed.`;
    case "invalid_theme_structure":
      return result.message;
    case "invalid_zip":
      return result.message;
  }
}

/**
 * The shared core of both "create a theme" (first upload) and "upload a
 * new version for an existing theme": extract the version from the
 * README (never invented — see extractReadmeVersion.ts), find-or-create the
 * ThemeVersion, and find-or-create the ThemeZip (deduped by checksum within
 * that version, so a byte-identical re-upload reuses the existing stored
 * copy instead of storing a duplicate). Never runs an audit — that's a
 * separate, explicit step (spec: "Do NOT automatically start the audit
 * immediately after upload").
 */
export async function uploadThemeVersion(themeId: Types.ObjectId | string, file: File): Promise<UploadVersionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const versionResult = await extractThemeVersionFromZip(buffer);
  if (!versionResult.ok) {
    return { ok: false, error: readmeErrorMessage(versionResult) };
  }

  const { version } = versionResult;
  const parsed = parseVersionForSort(version);
  const checksum = sha256(buffer);

  let themeVersion = await ThemeVersion.findOne({ themeId, version });
  if (!themeVersion) {
    themeVersion = await ThemeVersion.create({
      themeId,
      version,
      versionParts: parsed.parts ?? [],
      isSemver: parsed.parts !== null,
    });
  }

  let themeZip = await ThemeZip.findOne({ themeVersionId: themeVersion._id, checksumSha256: checksum });
  let reusedZip = true;
  if (!themeZip) {
    reusedZip = false;
    const gridFsFileId = await storeZipBuffer(buffer, file.name);
    themeZip = await ThemeZip.create({
      themeVersionId: themeVersion._id,
      filename: file.name,
      sizeBytes: buffer.byteLength,
      checksumSha256: checksum,
      gridFsFileId,
    });
  }

  return { ok: true, themeVersion, themeZip, reusedZip };
}
