import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { UserMenu } from "@/features/auth/components/user-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <span className="text-4xl">🚫</span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Access Denied
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            You are logged in as{" "}
            <strong className="text-slate-800">{user.email}</strong>, which does
            not have administrative privileges.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700"
            >
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-xs">
                PS
              </div>
              <span className="text-sm font-bold text-slate-900">
                ProjectSetu
              </span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
              Admin Console
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Project Workspace
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Admin Nav Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6 text-xs font-semibold">
            <Link
              href="/admin"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              📊 Overview
            </Link>
            <Link
              href="/admin/users"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              👥 Users & Roles
            </Link>
            <Link
              href="/admin/projects"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              📁 Tenant Projects
            </Link>
            <Link
              href="/admin/schemes"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              📜 Scheme Registry
            </Link>
            <Link
              href="/admin/audit"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              🔒 Audit Trail
            </Link>
            <Link
              href="/admin/diagnostics"
              className="border-b-2 border-transparent py-3 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
            >
              ⚡ Diagnostics
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Admin Content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
