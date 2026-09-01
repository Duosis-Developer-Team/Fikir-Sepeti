"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api-headers";
import { subscribeChanges } from "./realtime";
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

    // Üç sorgu (fikirler + kendi oyların + dönüştürülen sepetler) tek uçta.
    // Kendi oyunu okumak `vote.view_all` istemiyor — ayrım sunucuda
    // list_my_pool_votes RPC'siyle yapılıyor.
    const res = await apiFetch<{
      ideas: PoolIdea[];
      myVotes: string[];
      promotedBaskets: Record<string, PromotedBasketInfo>;
    }>("/api/pool", { tenantId });

    if (!res.ok || !res.data) return;

    setState((prev) => ({
      ...prev,
      ideas: res.data!.ideas ?? [],
      myVotes: new Set(res.data!.myVotes ?? []),
      promotedBaskets: res.data!.promotedBaskets ?? {},
      loading: false,
    }));
  }, [tenantId]);

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

    const unsubscribe = subscribeChanges({
      filters: [
        { table: "idea_pool", column: "tenant_id", value: tenantId },
        { table: "pool_votes", column: "tenant_id", value: tenantId },
      ],
      onChange: (payload) => {
        if (!active) return;

        // pool_votes: sayaç idea_pool UPDATE'i olarak da geliyor ama kendi
        // oyunu bilmek için yeniden çekmek gerekiyor (oy sahipleri gizli).
        if (payload.table === "pool_votes") {
          void fetchAll();
          return;
        }

        const row = (payload.new ?? payload.old) as PoolIdea | undefined;
        // truncated: satır 8KB'ı aştı ya da gizli içerik (moderasyon) —
        // sunucudan doğrusunu iste.
        if (payload.truncated || !row?.id) {
          void fetchAll();
          return;
        }

        setState((prev) => {
          if (payload.eventType === "DELETE") {
            return { ...prev, ideas: prev.ideas.filter((i) => i.id !== row.id) };
          }
          const map = new Map(prev.ideas.map((i) => [i.id, i]));
          map.set(row.id, row);
          return {
            ...prev,
            ideas: [...map.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
          };
        });
      },
      onStatus: (isConnected) => {
        if (!active) return;
        setState((p) => ({ ...p, connected: isConnected }));
        if (isConnected) stopPolling();
        else startPolling();
      },
    });

    const onVis = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVis);
      stopPolling();
      unsubscribe();
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
