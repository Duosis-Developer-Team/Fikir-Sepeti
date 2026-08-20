"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { votePoolIdea } from "./pool";
import type { BasketType, PoolIdea } from "./types";

export type PromotedBasketInfo = { type: BasketType; title: string };

type State = {
  ideas: PoolIdea[];
  myVotes: Set<string>;
  promotedBaskets: Record<string, PromotedBasketInfo>;
  loading: boolean;
  connected: boolean;
};

/**
 * Sepet (pool) realtime — useRealtimeVotes ile aynı dayanıklılık deseni:
 * optimistic oy, reconnect, 3sn fallback polling, visibility refresh.
 */
export function useRealtimePool(tenantId: string | null, voter: string) {
  const [state, setState] = useState<State>({
    ideas: [],
    myVotes: new Set(),
    promotedBaskets: {},
    loading: true,
    connected: false,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;

    const ideasRes = await supabase
      .from("idea_pool")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    let votedIds: string[] = [];
    const rpc = await supabase.rpc("list_my_pool_votes");
    if (!rpc.error && rpc.data) {
      votedIds = (rpc.data as { pool_idea_id: string }[]).map((r) => r.pool_idea_id);
    } else {
      const votesRes = await supabase
        .from("pool_votes")
        .select("pool_idea_id")
        .eq("tenant_id", tenantId)
        .eq("voter", voter);
      votedIds = ((votesRes.data as { pool_idea_id: string }[]) ?? []).map((r) => r.pool_idea_id);
    }

    const rows = (ideasRes.data as PoolIdea[]) ?? [];
    const byId = new Map<string, PoolIdea>();
    for (const row of rows) byId.set(row.id, row);

    const basketIds = [...new Set(rows.map((r) => r.promoted_basket_id).filter((id): id is string => !!id))];
    let promotedBaskets: Record<string, PromotedBasketInfo> = {};
    if (basketIds.length) {
      const basketsRes = await supabase.from("baskets").select("id, type, title").in("id", basketIds);
      for (const b of (basketsRes.data as { id: string; type: BasketType; title: string }[]) ?? []) {
        promotedBaskets[b.id] = { type: b.type, title: b.title };
      }
    }

    setState((prev) => ({
      ...prev,
      ideas: [...byId.values()],
      myVotes: new Set(votedIds),
      promotedBaskets,
      loading: false,
    }));
  }, [tenantId, voter]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void fetchAll();
    }, 3000);
  }, [fetchAll]);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    void fetchAll();

    const channel = supabase
      .channel("pool:" + tenantId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "idea_pool", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (!active) return;
          const row = (payload.new ?? payload.old) as PoolIdea | undefined;
          if (!row?.id) {
            void fetchAll();
            return;
          }
          setState((prev) => {
            if (payload.eventType === "DELETE") {
              return { ...prev, ideas: prev.ideas.filter((i) => i.id !== row.id) };
            }
            const map = new Map(prev.ideas.map((i) => [i.id, i]));
            map.set(row.id, row);
            return { ...prev, ideas: [...map.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pool_votes", filter: `tenant_id=eq.${tenantId}` },
        () => {
          if (active) void fetchAll();
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setState((p) => ({ ...p, connected: true }));
          stopPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setState((p) => ({ ...p, connected: false }));
          startPolling();
        }
      });

    const onVis = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVis);
      stopPolling();
      void supabase.removeChannel(channel);
    };
  }, [tenantId, fetchAll, startPolling, stopPolling]);

  const vote = useCallback(
    async (poolIdeaId: string) => {
      if (!tenantId) return;

      let alreadyVoted = false;
      setState((prev) => {
        if (prev.myVotes.has(poolIdeaId)) {
          alreadyVoted = true;
          return prev;
        }
        const myVotes = new Set(prev.myVotes);
        myVotes.add(poolIdeaId);
        const ideas = prev.ideas.map((i) =>
          i.id === poolIdeaId ? { ...i, vote_count: i.vote_count + 1 } : i
        );
        return { ...prev, myVotes, ideas };
      });
      if (alreadyVoted) return;

      // API route (not a direct client insert) so poll deadline is enforced and
      // idea_pool.status flips "new" -> "voting" on first vote, same as the server does.
      const res = await votePoolIdea({ pool_idea_id: poolIdeaId, voter, tenant_id: tenantId });

      if (!res.ok) {
        setState((prev) => {
          const myVotes = new Set(prev.myVotes);
          myVotes.delete(poolIdeaId);
          const ideas = prev.ideas.map((i) =>
            i.id === poolIdeaId ? { ...i, vote_count: Math.max(0, i.vote_count - 1) } : i
          );
          return { ...prev, myVotes, ideas };
        });
      }
      void fetchAll();
    },
    [tenantId, voter, fetchAll]
  );

  return { ...state, refresh: fetchAll, vote };
}
