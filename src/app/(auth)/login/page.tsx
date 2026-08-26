"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signInAction } from "@/app/actions/auth-actions";
import { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER } from "@/lib/auth/constants";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signInAction({ email, password });
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error || "Failed to sign in.");
      }
    });
  };

  const handleQuickSignIn = (demoEmail: string, demoPass: string) => {
    setError(null);
    startTransition(async () => {
      const res = await signInAction({ email: demoEmail, password: demoPass });
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error || "Failed to sign in.");
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-md">
          PS
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
          Sign In to ProjectSetu
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Indian MSME Bankable Detailed Project Report & Scheme Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-6 py-8 shadow-xl ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10">
          {/* Quick Demo Logins */}
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
            <p className="mb-2 text-xs font-bold text-indigo-950">
              🚀 Fast Instant Demo Sign-In:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleQuickSignIn(
                    DEFAULT_DEMO_USER.email,
                    DEFAULT_DEMO_USER.password,
                  )
                }
                className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                👤 Entrepreneur
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleQuickSignIn(
                    DEFAULT_ADMIN_USER.email,
                    DEFAULT_ADMIN_USER.password,
                  )
                }
                className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white shadow-sm hover:bg-black disabled:opacity-50"
              >
                🛡️ Admin User
              </button>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. kiran@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to ProjectSetu Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
