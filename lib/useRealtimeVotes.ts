"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api-headers";
import { subscribeChanges } from "./realtime";
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
    // Sepet + fikirler + KENDİ oyların tek uçtan. Kendi oyunu okumak
    // `vote.view_all` istemiyor; sunucu bunu list_my_votes RPC'siyle ayırıyor
    // (S3 kararı). Eskiden burada RPC başarısız olursa votes tablosuna düşen
    // bir yedek yol vardı — artık gerekmiyor, ayrım sunucuda tek yerde.
    const res = await apiFetch<{
      basket: Basket;
      ideas: Idea[];
      myVotes: { phase: string; idea_id: string }[];
    }>(`/api/basket/${basketId}/live`);

    if (!res.ok || !res.data) return;

    tenantRef.current = res.data.basket?.tenant_id ?? null;

    const myVotes: Record<string, string> = {};
    for (const v of res.data.myVotes ?? []) myVotes[v.phase] = v.idea_id;

    setState((prev) => ({
      ...prev,
      basket: res.data!.basket ?? prev.basket,
      ideas: res.data!.ideas ?? prev.ideas,
      myVotes,
      loading: false,
    }));
  }, [basketId]);

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

    // Abonelik: fikirler satır bazında yerinde güncelleniyor (yeniden çekmeden),
    // sepet güncellemesi ise tümüyle değiştiriliyor — eski davranışın aynısı.
    // NOTIFY 8KB sınırını aşarsa satır gelmiyor (truncated); o durumda yeniden
    // çekiyoruz, yoksa liste sessizce eskir.
    const unsubscribe = subscribeChanges({
      filters: [
        { table: "ideas", column: "basket_id", value: basketId },
        { table: "baskets", column: "id", value: basketId },
      ],
      onChange: (payload) => {
        if (!active) return;
        if (payload.truncated) {
          void fetchAll();
          return;
        }
        if (payload.table === "baskets") {
          if (payload.eventType === "UPDATE" && payload.new) {
            setState((prev) => ({ ...prev, basket: payload.new as unknown as Basket }));
          }
          return;
        }
        setState((prev) => {
          let ideas = prev.ideas;
          if (payload.eventType === "INSERT" && payload.new) {
            const row = payload.new as unknown as Idea;
            ideas = prev.ideas.some((i) => i.id === row.id) ? prev.ideas : [...prev.ideas, row];
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const row = payload.new as unknown as Idea;
            ideas = prev.ideas.map((i) => (i.id === row.id ? { ...i, ...row } : i));
          } else if (payload.eventType === "DELETE" && payload.old) {
            const old = payload.old as { id: string };
            ideas = prev.ideas.filter((i) => i.id !== old.id);
          }
          return { ...prev, ideas };
        });
      },
      onStatus: (isConnected) => {
        if (!active) return;
        setState((prev) => ({ ...prev, connected: isConnected }));
        if (isConnected) {
          stopPolling();
          void fetchAll(); // yeniden bağlandıktan sonra kaçırılanları topla
        } else {
          startPolling();
        }
      },
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      stopPolling();
      unsubscribe();
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

      try {
        if (h.action === "unvote") {
          const res = await apiFetch(
            `/api/basket/${basketId}/vote?phase=${encodeURIComponent(phase)}`,
            { method: "DELETE", email: voter, tenantId: tenantRef.current }
          );
          if (!res.ok) throw new Error(res.error);
        } else {
          // Sunucu eski oyu kendisi siliyor (unique(basket,phase,voter) zaten
          // ikinciyi reddederdi); istemcinin sil+ekle sırasını yönetmesine
          // gerek kalmadı.
          const res = await apiFetch(`/api/basket/${basketId}/vote`, {
            method: "POST",
            email: voter,
            tenantId: tenantRef.current,
            body: JSON.stringify({ idea_id: ideaId, phase }),
          });
          if (!res.ok) throw new Error(res.error);
        }
      } catch {
        void fetchAll(); // hata → sunucunun doğrusunu getir
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
