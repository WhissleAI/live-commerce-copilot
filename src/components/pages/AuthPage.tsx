/**
 * Sign in and create an account — one form, two verbs.
 *
 * Everything a seller does here is attributed: a sent reply, an approved
 * markdown, an eBay consent, a deleted session. The audit chain names a person,
 * so there is a person. No guest door: the landing page is what a visitor sees.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogoLockup } from "@/components/brand/Logo";
import { login, register } from "@/lib/api";
import { Button } from "@/components/ui/kit";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await register(email, password, name);
      else await login(email, password);
      await navigate({ to: "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-sm bg-panel px-3 py-2.5 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[380px]">
        <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold">
          <LogoLockup size={20} />
        </Link>
        <h1 className="mt-6 text-[22px] font-semibold tracking-[-0.01em]">
          {mode === "register" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-[12.5px] text-text-muted">
          {mode === "register"
            ? "One account, your sessions. Every send and approval is recorded against it."
            : "Welcome back. Your sessions, reports and eBay connection are where you left them."}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 flex flex-col gap-3">
          {mode === "register" ? (
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              Your name, as the audit will record it
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="Rae Okafor"
                autoComplete="name"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            Email
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            Password{mode === "register" ? " · at least 8 characters" : ""}
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>
          {error ? <p className="text-[12.5px] text-bad">{error}</p> : null}
          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={busy || !email || !password}
            className="mt-1 justify-center"
          >
            {busy ? "One moment…" : mode === "register" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-[12.5px] text-text-muted">
          {mode === "register" ? (
            <>
              Already have one?{" "}
              <Link to="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link to="/register" className="text-accent hover:underline">
                Create an account
              </Link>
            </>
          )}
          {" · "}
          <Link to="/privacy" className="hover:text-text">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="hover:text-text">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
