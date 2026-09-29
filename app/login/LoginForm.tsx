"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/app/_components/ui/Button";

const INPUT_CLASSES =
  "block w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-zinc-50";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.ok) {
        // Full navigation so the server renders the signed-in shell fresh.
        window.location.assign(nextPath);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Sign-in failed. Please try again.");
      setPassword("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div aria-live="assertive">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-fail-bg px-3 py-2.5 text-sm text-status-fail-text">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={INPUT_CLASSES}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            aria-invalid={error ? true : undefined}
            aria-describedby={capsLock ? "caps-lock-hint" : undefined}
            className={`${INPUT_CLASSES} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-zinc-500 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:text-zinc-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        {capsLock && (
          <p id="caps-lock-hint" className="mt-1.5 text-xs text-status-warning-text">
            Caps Lock is on.
          </p>
        )}
      </div>

      <Button type="submit" loading={pending} className="w-full py-2.5">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
