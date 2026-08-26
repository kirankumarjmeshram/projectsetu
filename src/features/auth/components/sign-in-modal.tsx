"use client";

import React, { useState, useTransition } from "react";

import { signInAction } from "@/app/actions/auth-actions";
import { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER } from "@/lib/auth/constants";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signInAction({ email, password });
      if (res.success) {
        onSuccess?.();
        onClose();
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
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || "Failed to sign in.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Sign In to ProjectSetu
            </h3>
            <p className="text-xs text-slate-500">
              Access your project portfolio and bankable DPR models
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Quick Demo Login Badges */}
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-indigo-900">
            🚀 Instant Demo Credentials:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                handleQuickSignIn(
                  DEFAULT_DEMO_USER.email,
                  DEFAULT_DEMO_USER.password,
                )
              }
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
              className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
            >
              🛡️ Admin Console
            </button>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="mt-4 space-y-4">
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

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Sign In →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
