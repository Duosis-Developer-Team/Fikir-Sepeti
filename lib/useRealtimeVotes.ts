"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Basket, Idea, Phase } from "./types";

type State = {
  basket: Basket | null;
  ideas: Idea[];
  myVotes: Record<string, string>; // phase -> idea_id (bu kullanıcının o fazdaki oyu)
  loading: boolean;
  connected: boolean;
};

/**
 * ★ REALTIME OYLAMA PRIMITIFI — sosyal oy / build finalist / presenter oyu, üçü de bunu kullanır.
 *
 * - baskets + ideas postgres_changes canlı dinlenir (vote_count trigger ile güncellenir).
 * - Oy: optimistic local artış → insert → realtime/fetch ile reconcile (çift sayma yok, REPLACE mantığı).
 * - Dayanıklılık: reconnect (subscribe status), kopunca 3sn fallback polling, sekme görünürlüğünde tazeleme.
 */
export function useRealtimeVotes(basketId: string, voter: string) {
  const [state, setState] = useState<State>({
    basket: null,
    ideas: [],
    myVotes: {},
    loading: true,
    connected: false,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tenantRef = useRef<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [basketRes, ideasRes] = await Promise.all([
      supabase.from("baskets").select("*").eq("id", basketId).single(),
      supabase
        .from("ideas")
        .select("*")
        .eq("basket_id", basketId)
        .order("created_at", { ascending: true }),
    ]);

    if (basketRes.data) {
      tenantRef.current = (basketRes.data as Basket).tenant_id ?? null;
    }

    // Prefer masked RPC; fall back to filtered votes select (own rows / vote.view_all)
    let voteRows: { phase: string; idea_id: string }[] = [];
    const rpc = await supabase.rpc("list_my_votes", { p_basket: basketId });
    if (!rpc.error && rpc.data) {
      voteRows = rpc.data as { phase: string; idea_id: string }[];
    } else {
      const votesRes = await supabase
        .from("votes")
        .select("phase, idea_id")
        .eq("basket_id", basketId)
        .eq("voter", voter);
      voteRows = (votesRes.data as { phase: string; idea_id: string }[]) ?? [];
    }

    const myVotes: Record<string, string> = {};
    for (const v of voteRows) {
      myVotes[v.phase] = v.idea_id;
    }

    setState((prev) => ({
      ...prev,
      basket: (basketRes.data as Basket) ?? prev.basket,
      ideas: (ideasRes.data as Idea[]) ?? prev.ideas,
      myVotes,
      loading: false,
    }));
  }, [basketId, voter]);

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
    let active = true;
    void fetchAll();

    const channel = supabase
      .channel("basket:" + basketId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ideas", filter: `basket_id=eq.${basketId}` },
        (payload) => {
          if (!active) return;
          setState((prev) => {
            let ideas = prev.ideas;
            if (payload.eventType === "INSERT") {
              const row = payload.new as Idea;
              ideas = prev.ideas.some((i) => i.id === row.id)
                ? prev.ideas
                : [...prev.ideas, row];
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as Idea;
              ideas = prev.ideas.map((i) => (i.id === row.id ? { ...i, ...row } : i));
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              ideas = prev.ideas.filter((i) => i.id !== old.id);
            }
            return { ...prev, ideas };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "baskets", filter: `id=eq.${basketId}` },
        (payload) => {
          if (!active) return;
          setState((prev) => ({ ...prev, basket: payload.new as Basket }));
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setState((prev) => ({ ...prev, connected: true }));
          stopPolling();
          void fetchAll(); // reconnect sonrası stale veriyi düzelt
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setState((prev) => ({ ...prev, connected: false }));
          startPolling();
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [basketId, fetchAll, startPolling, stopPolling]);

  /**
   * Oy ver / değiştir / geri al — optimistic.
   * Aynı fikre tekrar tıkla → oyu geri al. Başka fikre tıkla → oyunu taşı.
   * Trigger sadece INSERT/DELETE'te çalıştığı için değiştirmede eski oyu silip yenisini ekleriz.
   */
  const vote = useCallback(
    async (ideaId: string, phase: Phase) => {
      const h: { action: "unvote" | "change" | "new" } = { action: "new" };
      setState((prev) => {
        const prevId = prev.myVotes[phase];
        if (prevId === ideaId) {
          h.action = "unvote";
          const nextVotes = { ...prev.myVotes };
          delete nextVotes[phase];
          return {
            ...prev,
            myVotes: nextVotes,
            ideas: prev.ideas.map((i) => (i.id === ideaId ? { ...i, vote_count: Math.max(0, i.vote_count - 1) } : i)),
          };
        }
        h.action = prevId ? "change" : "new";
        return {
          ...prev,
          myVotes: { ...prev.myVotes, [phase]: ideaId },
          ideas: prev.ideas.map((i) => {
            if (i.id === ideaId) return { ...i, vote_count: i.vote_count + 1 };
            if (i.id === prevId) return { ...i, vote_count: Math.max(0, i.vote_count - 1) };
            return i;
          }),
        };
      });

      const delOld = () =>
        supabase.from("votes").delete().eq("basket_id", basketId).eq("phase", phase).eq("voter", voter);
      const insNew = () =>
        supabase.from("votes").insert({
          basket_id: basketId,
          idea_id: ideaId,
          phase,
          voter,
          tenant_id: tenantRef.current,
        });

      try {
        if (h.action === "unvote") {
          await delOld();
        } else {
          if (h.action === "change") await delOld();
          const { error } = await insNew();
          if (error && error.code !== "23505") throw error;
        }
      } catch {
        void fetchAll(); // hata → server doğrusunu getir
      }
    },
    [basketId, voter, fetchAll]
  );

  return {
    basket: state.basket,
    ideas: state.ideas,
    myVotes: state.myVotes,
    loading: state.loading,
    connected: state.connected,
    vote,
    refresh: fetchAll,
  };
}
