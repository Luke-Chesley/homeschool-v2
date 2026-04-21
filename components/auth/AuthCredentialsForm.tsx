"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPathWithNext, sanitizeNextPath } from "@/lib/auth/next";
import { getBrowserAuthClient } from "@/lib/auth/browser";
import { getAuthConfirmRedirectUrl } from "@/lib/auth/redirects";

type AuthCredentialsFormProps = {
  mode: "login" | "sign_up";
};

export function AuthCredentialsForm({ mode }: AuthCredentialsFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"), "/today");
  const setupPath = buildPathWithNext("/auth/setup", nextPath);
  const alternateAuthPath =
    mode === "login"
      ? buildPathWithNext("/auth/sign-up", nextPath)
      : buildPathWithNext("/auth/login", nextPath);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedFullName = fullName.trim();

    if (!normalizedEmail) {
      setError("Enter an email address.");
      setNotice(null);
      return;
    }

    if (!password) {
      setError("Enter a password.");
      setNotice(null);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const auth = getBrowserAuthClient();

      if (mode === "login") {
        const { error: authError } = await auth.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          throw authError;
        }

        router.replace(nextPath);
        router.refresh();
        return;
      }

      const redirectTo = getAuthConfirmRedirectUrl(nextPath);
      const { data, error: authError } = await auth.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: normalizedFullName ? { full_name: normalizedFullName } : undefined,
        },
      });

      if (authError) {
        throw authError;
      }

      if (data.session) {
        router.replace(setupPath);
        router.refresh();
        return;
      }

      setNotice("Check your email to finish account setup and resume where you left off.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function fieldClassName() {
    return "field-shell h-12 w-full rounded-2xl px-4 text-sm shadow-none";
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/76 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          {mode === "login" ? "Welcome back" : "Create adult account"}
        </div>
        <CardTitle className="mt-3">{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Use the adult account that owns the household workspace."
            : "Create the adult account that will own the household workspace."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          {mode === "sign_up" ? (
            <div className="space-y-1.5">
              <label htmlFor="full-name" className="text-sm font-medium">
                Full name
              </label>
              <input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={fieldClassName()}
                placeholder="Avery Rivera"
                autoComplete="name"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClassName()}
              placeholder="parent@example.com"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              spellCheck={false}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClassName()}
              placeholder="At least 6 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          {notice ? (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">{notice}</p>
          ) : null}

          <Button type="submit" className="w-full gap-2 rounded-2xl" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
            {!submitting ? <ArrowRight className="size-4" /> : null}
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          {mode === "login" ? (
            <p>
              Need an account?{" "}
              <Link href={alternateAuthPath} className="text-foreground underline underline-offset-4">
                Create one
              </Link>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <Link href={alternateAuthPath} className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          )}
          {mode === "login" ? (
            <span className="text-xs">Use the same email tied to the household.</span>
          ) : (
            <span className="text-xs">Setup continues directly into the household workspace.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
