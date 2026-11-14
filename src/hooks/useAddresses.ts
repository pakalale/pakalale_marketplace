"use client";

import { useCallback, useEffect, useState } from "react";

export interface Address {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  details: string;
  isDefault: boolean;
}

export type AddressInput = Partial<Omit<Address, "id">>;

/** The signed-in person's saved addresses, with add, edit and delete. */
export function useAddresses(enabled = true) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const call = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    setError("");
    const res = await fetch(input, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Something went wrong";
      setError(message);
      throw new Error(message);
    }
    setAddresses(data.addresses || []);
    return data.addresses as Address[];
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch("/api/user/addresses")
      .then((res) => (res.ok ? res.json() : { addresses: [] }))
      .then((data) => {
        if (active) setAddresses(data.addresses || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    addresses,
    loading,
    error,
    add: (input: AddressInput) => call("/api/user/addresses", json("POST", input)),
    update: (id: string, input: AddressInput) => call("/api/user/addresses", json("PUT", { id, ...input })),
    remove: (id: string) => call(`/api/user/addresses?id=${id}`, { method: "DELETE" }),
  };
}
