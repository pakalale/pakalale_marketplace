"use client";

import { useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AccountHeading from "@/components/account/AccountHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses, type Address, type AddressInput } from "@/hooks/useAddresses";

const EMPTY: AddressInput = { label: "Home", recipient: "", phone: "", details: "", isDefault: false };

function AddressForm({ initial, onSave, onCancel }: { initial: AddressInput; onSave: (input: AddressInput) => Promise<unknown>; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof AddressInput) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave(form);
        } catch {
          /* the hook shows the error */
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3 rounded-2xl border border-brand/30 bg-card p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="address-label">Label</Label>
          <Input id="address-label" value={form.label} onChange={set("label")} placeholder="Home, Work..." maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address-recipient">Recipient (optional)</Label>
          <Input id="address-recipient" value={form.recipient} onChange={set("recipient")} maxLength={80} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-details">Address</Label>
        <Input id="address-details" required value={form.details} onChange={set("details")} placeholder="Area, street, house number, nearby landmark" maxLength={300} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-phone">Phone (optional)</Label>
        <Input id="address-phone" type="tel" value={form.phone} onChange={set("phone")} maxLength={40} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(form.isDefault)} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} className="accent-[var(--brand)]" />
        Use as my default address
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="rounded-xl">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save address
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl">Cancel</Button>
      </div>
    </form>
  );
}

export default function AddressesPage() {
  const { addresses, loading, error, add, update, remove } = useAddresses();
  const [editing, setEditing] = useState<string | null>(null);

  const startEdit = (address: Address) => setEditing(address.id);

  return (
    <>
      <AccountHeading title="Addresses" description="Saved places we can deliver to. Pick one at checkout.">
        {editing !== "new" && (
          <Button onClick={() => setEditing("new")} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Add address
          </Button>
        )}
      </AccountHeading>

      {error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {editing === "new" && (
        <div className="mb-4">
          <AddressForm
            initial={EMPTY}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await add(input);
              toast.success("Address saved");
              setEditing(null);
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((key) => <Skeleton key={key} className="h-32 rounded-2xl" />)}
        </div>
      ) : addresses.length === 0 && editing !== "new" ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No saved addresses</p>
          <p className="mt-1 text-sm text-muted-foreground">Add one now, or save it the next time you check out.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) =>
            editing === address.id ? (
              <li key={address.id} className="sm:col-span-2">
                <AddressForm
                  initial={address}
                  onCancel={() => setEditing(null)}
                  onSave={async (input) => {
                    await update(address.id, input);
                    toast.success("Address updated");
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={address.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-brand" /> {address.label}
                  </p>
                  {address.isDefault && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-brand">Default</span>}
                </div>
                <p className="mt-2 flex-1 text-sm">{address.details}</p>
                {(address.recipient || address.phone) && (
                  <p className="mt-1 text-xs text-muted-foreground">{[address.recipient, address.phone].filter(Boolean).join(" · ")}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(address)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  {!address.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => update(address.id, { isDefault: true }).catch(() => {})}>
                      <Star className="mr-1 h-3.5 w-3.5" /> Make default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Delete "${address.label}"?`)) remove(address.id).catch(() => {});
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </>
  );
}
