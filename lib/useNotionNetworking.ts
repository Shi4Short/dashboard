"use client";

import { useEffect, useState } from "react";
import type { NetworkingContact } from "./types";

export function useNotionNetworking() {
  const [contacts, setContacts] = useState<NetworkingContact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notion/networking")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setContacts(body.contacts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));
  }, []);

  return { contacts, loaded, error };
}
