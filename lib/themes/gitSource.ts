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

/** git's reason for a failure: its first stderr line is only "Cloning into ...", the cause is on a "fatal:" / "error:" line. */
function gitFailureReason(err: unknown): string {
  const e = err as NodeJS.ErrnoException & { stderr?: string };
  if (e.code === "ENOENT") return "git is not installed on the server.";
  const lines = String(e.stderr ?? e.message).split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.filter((l) => /^(fatal|error|remote):/i.test(l)).join(" ") || lines[lines.length - 1] || "unknown error").slice(0, 300);
}

export type GitTestResult = { ok: true; branch: string; commit: string; hasThemeRoot: boolean; tokenSent: boolean } | { ok: false; error: string; tokenSent: boolean };

/**
 * Checks a repository the way the audit will read it, without downloading the files: `git ls-remote` (URL, access, branch), then a
 * file-less clone to see whether the theme's folders (sections/, layout/, config/) are at the repository root.
 */
export async function testGitSource(repoUrl: string, branch: string | null): Promise<GitTestResult> {
  const tokenSent = Boolean(process.env.GIT_ACCESS_TOKEN?.trim());
  if (!isValidGitUrl(repoUrl)) return { ok: false, error: "The Git URL is not a valid https:// address.", tokenSent };
  const env = gitEnv(repoUrl);
  let commit = "";
  let resolved = branch ?? "default branch";
  try {
    const ref = branch ? `refs/heads/${branch}` : "HEAD";
    const { stdout } = await run("git", ["ls-remote", "--", repoUrl, ref], { env, timeout: 60_000 });
    const first = stdout.split("\n").find((l) => l.trim());
    if (!first) return { ok: false, error: `The repository was reached, but it has no branch "${branch}".`, tokenSent };
    commit = first.split(/\s+/)[0];
  } catch (err) {
    return { ok: false, error: gitFailureReason(err), tokenSent };
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "theme-git-test-"));
  try {
    await run("git", ["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", ...(branch ? ["--branch", branch] : []), "--", repoUrl, dir], { env, timeout: 120_000 });
    const { stdout } = await run("git", ["-C", dir, "ls-tree", "--name-only", "HEAD"], { env });
    const names = new Set(stdout.split("\n").map((l) => l.trim()));
    if (!branch) {
      const { stdout: head } = await run("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { env });
      resolved = head.trim() || resolved;
    }
    return { ok: true, branch: resolved, commit: commit.slice(0, 7), hasThemeRoot: ["sections", "layout", "config"].every((d) => names.has(d)), tokenSent };
  } catch (err) {
    return { ok: false, error: gitFailureReason(err), tokenSent };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
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
    throw new Error(`Could not read the Git repository: ${gitFailureReason(err)}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
