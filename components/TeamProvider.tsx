"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";

interface TeamCtx { currency: string; refresh: () => void }

// The default lets components render (and be tested) without the provider.
const Ctx = createContext<TeamCtx>({ currency: "USD", refresh: () => {} });

/** Currency of the team, read from team data. */
export const useCurrency = () => useContext(Ctx).currency;
/** Call after saving team settings so money everywhere picks up a change. */
export const useTeamRefresh = () => useContext(Ctx).refresh;

export function TeamProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState("USD");
  const refresh = useCallback(() => {
    api
      .getTeam()
      .then((t) => setCurrency(String(t.currency || "USD")))
      .catch(() => {
        /* keep the last known currency */
      });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const value = useMemo(() => ({ currency, refresh }), [currency, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
