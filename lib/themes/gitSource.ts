import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const CLONE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ZIP_BYTES = 200 * 1024 * 1024; // same cap as an uploaded ZIP (lib/theme-parser/zip.ts)

/** Only https:// repositories: never file://, ssh or a leading "-" that git would read as an option. */
export function isValidGitUrl(url: string): boolean {
  return /^https:\/\/[^\s/]+\/[^\s]+$/.test(url) && url.length <= 300;
}

/**
 * Environment for git: never prompts, and for a private repo sends GIT_ACCESS_TOKEN (a read-only token) as a header for that
 * host only. Passed through GIT_CONFIG_* variables rather than the command line so it isn't visible in the process list.
 */
function gitEnv(repoUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const token = process.env.GIT_ACCESS_TOKEN?.trim();
  if (token) {
    const origin = new URL(repoUrl).origin;
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = `http.${origin}/.extraheader`;
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
  }
  return env;
}

export type GitZip = { buffer: Buffer; commit: string };

/**
 * Exports the latest commit of a theme's branch as a ZIP (the form the audit and the version store already take).
 * The theme's files (config/, layout/, sections/ ...) must be at the repository root. Throws with a plain message on failure.
 */
export async function fetchGitZip(repoUrl: string, branch: string | null): Promise<GitZip> {
  if (!isValidGitUrl(repoUrl)) throw new Error("The Git URL is not a valid https:// address.");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "theme-git-"));
  const env = gitEnv(repoUrl);
  try {
    const clone = ["clone", "--depth", "1", ...(branch ? ["--branch", branch] : []), "--", repoUrl, dir];
    await run("git", clone, { env, timeout: CLONE_TIMEOUT_MS });
    const { stdout: sha } = await run("git", ["-C", dir, "rev-parse", "HEAD"], { env });
    const { stdout } = await run("git", ["-C", dir, "archive", "--format=zip", "HEAD"], {
      env,
      encoding: "buffer",
      maxBuffer: MAX_ZIP_BYTES,
      timeout: CLONE_TIMEOUT_MS,
    });
    return { buffer: stdout as unknown as Buffer, commit: sha.trim() };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") throw new Error("git is not installed on the server.");
    // git's own message, without the URL (it can contain a token-less but private repo name) beyond the first line.
    const reason = String(e.stderr ?? e.message).split("\n").find((l) => l.trim()) ?? "unknown error";
    throw new Error(`Could not read the Git repository: ${reason.slice(0, 200)}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
