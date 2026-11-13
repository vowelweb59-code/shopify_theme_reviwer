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

/**
 * One line for the boot log saying whether GIT_ACCESS_TOKEN reached the app, never the token itself: only whether it is set, its
 * kind (from GitHub's public prefix) and length, and whether it carries quotes or whitespace that would make GitHub reject it.
 */
export function gitTokenStatus(env: NodeJS.ProcessEnv): string {
  const raw = env.GIT_ACCESS_TOKEN;
  if (raw === undefined) return "GIT_ACCESS_TOKEN is not set: private repositories will fail (public ones still clone).";
  const token = raw.trim();
  if (!token) return "GIT_ACCESS_TOKEN is set but empty.";
  const kind = token.startsWith("github_pat_") ? "fine-grained token" : token.startsWith("ghp_") ? "classic token" : token.startsWith("gh") ? "GitHub token" : "unrecognised format";
  const problems = [
    /^["']|["']$/.test(token) ? "wrapped in quotes" : "",
    /\s/.test(token) ? "contains whitespace" : "",
    raw !== token ? "has leading/trailing whitespace (trimmed)" : "",
  ].filter(Boolean);
  return `GIT_ACCESS_TOKEN is set (${kind}, ${token.length} characters${problems.length ? `; check: ${problems.join(", ")}` : ""}).`;
}

export type GitZip ={ buffer: Buffer; commit: string };

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
    // git's own reason: its first line is only "Cloning into '/tmp/...'...", the cause is on a "fatal:" / "error:" line.
    const lines = String(e.stderr ?? e.message).split("\n").map((l) => l.trim()).filter(Boolean);
    const reason = lines.filter((l) => /^(fatal|error|remote):/i.test(l)).join(" ") || lines[lines.length - 1] || "unknown error";
    throw new Error(`Could not read the Git repository: ${reason.slice(0, 300)}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
