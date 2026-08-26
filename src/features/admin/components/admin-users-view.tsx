"use client";

import React, { useEffect, useState, useTransition } from "react";

import {
  adminListUsersAction,
  adminToggleUserStatusAction,
  adminUpdateUserRoleAction,
} from "@/app/actions/admin-actions";

export function AdminUsersView() {
  const [users, setUsers] = useState<
    Array<{
      id: string;
      email: string;
      name: string;
      role: "USER" | "ADMIN";
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadUsers = () => {
    startTransition(async () => {
      const res = await adminListUsersAction();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        setError(res.error || "Failed to load users.");
      }
    });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = (userId: string, newRole: "USER" | "ADMIN") => {
    startTransition(async () => {
      const res = await adminUpdateUserRoleAction(userId, newRole);
      if (res.success) {
        loadUsers();
      } else {
        alert(res.error || "Failed to update user role.");
      }
    });
  };

  const handleStatusToggle = (userId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await adminToggleUserStatusAction(userId, !currentStatus);
      if (res.success) {
        loadUsers();
      } else {
        alert(res.error || "Failed to toggle user status.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            User & Role Management
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Manage authenticated tenant accounts, administrative privileges, and
            account activity states.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Registered</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {u.email}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        u.role === "ADMIN"
                          ? "border border-purple-200 bg-purple-50 text-purple-700"
                          : "border border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        u.isActive ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.isActive ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      />
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        handleRoleChange(
                          u.id,
                          u.role === "ADMIN" ? "USER" : "ADMIN",
                        )
                      }
                      className="rounded border border-indigo-200 px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {u.role === "ADMIN" ? "Demote to User" : "Make Admin"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatusToggle(u.id, u.isActive)}
                      className={`rounded border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                        u.isActive
                          ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
