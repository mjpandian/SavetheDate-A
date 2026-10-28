"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type MemberSummary } from "@/lib/api-client";
import { inputClass } from "@/components/Field";

const STORAGE_KEY = "savethedate.memberId";

interface MemberCtx {
  members: MemberSummary[];
  memberId: string | null;
  member: MemberSummary | null;
  setMemberId: (id: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<MemberCtx | null>(null);

export function useMember(): MemberCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMember must be used inside <MemberProvider>");
  return v;
}

/** "Pick your name" (no auth in the MVP). The choice is remembered in localStorage. */
export function MemberProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [memberId, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .listMembers()
      .then((list) => {
        setMembers(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(STORAGE_KEY);
        } catch {
          /* storage can be blocked; fall back to the first member */
        }
        setId(list.find((m) => m.id === saved)?.id ?? list[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the team"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setMemberId = useCallback((id: string) => {
    setId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<MemberCtx>(
    () => ({
      members,
      memberId,
      member: members.find((m) => m.id === memberId) ?? null,
      setMemberId,
      loading,
      error,
      reload: load,
    }),
    [members, memberId, setMemberId, loading, error, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function MemberSelect({ id = "member-select", label = "You are" }: { id?: string; label?: string }) {
  const { members, memberId, setMemberId, loading } = useMember();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={`${inputClass} !w-auto min-w-32`}
        value={memberId ?? ""}
        disabled={loading || members.length === 0}
        onChange={(e) => setMemberId(e.target.value)}
      >
        {members.length === 0 && <option value="">{loading ? "Loading…" : "No members"}</option>}
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
