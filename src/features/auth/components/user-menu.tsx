"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getCurrentUserAction,
  signOutAction,
} from "@/app/actions/auth-actions";
import type { AuthUser } from "@/lib/auth/contracts";
import { SignInModal } from "./sign-in-modal";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    void getCurrentUserAction().then((u) => {
      if (mounted) {
        setUser(u);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
      setUser(null);
      router.refresh();
    });
  };

  const handleSignInSuccess = () => {
    void getCurrentUserAction().then((u) => {
      setUser(u);
      router.refresh();
    });
  };

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsSignInOpen(true)}
          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Sign In
        </button>

        <SignInModal
          isOpen={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
          onSuccess={handleSignInSuccess}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.role === "ADMIN" && (
        <Link
          href="/admin"
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          <span>🛡️</span>
          <span>Admin Console</span>
        </Link>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1">
        <div className="flex flex-col text-left">
          <span className="text-xs leading-tight font-bold text-slate-800">
            {user.name}
          </span>
          <span className="text-[10px] leading-tight text-slate-500">
            {user.role === "ADMIN" ? "Administrator" : "Entrepreneur"}
          </span>
        </div>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSignOut}
        title="Sign Out"
        className="rounded-lg p-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        {isPending ? "..." : "Sign Out"}
      </button>
    </div>
  );
}
