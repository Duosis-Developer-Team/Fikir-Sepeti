"use client";

import { useEffect, useState } from "react";

const KEY = "fikirsepeti:name";

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function storeName(name: string) {
  window.localStorage.setItem(KEY, name.trim());
}

/** İsim gate hook — auth yerine. null = henüz okunmadı, "" = isim yok. */
export function useName() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(getStoredName());
  }, []);

  const save = (value: string) => {
    const clean = value.trim();
    storeName(clean);
    setName(clean);
  };

  return { name, save, ready: name !== null };
}
