"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "Electronics",
  "Fashion & Clothing",
  "Fresh Food",
  "Furniture & Home",
  "Beauty & Cosmetics",
  "Groceries",
  "Books",
  "Sports",
  "Auto & Parts",
  "Services",
];

interface SpecialtyPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function SpecialtyPicker({ value, onChange }: SpecialtyPickerProps) {
  const [customInput, setCustomInput] = useState("");

  const toggleCategory = (category: string) => {
    if (value.includes(category)) {
      onChange(value.filter((item) => item !== category));
    } else {
      onChange([...value, category]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const exists = value.some((item) => item.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setCustomInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  const customSelected = value.filter((item) => !CATEGORIES.includes(item));

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Select categories that fit your shop.</p>

      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((category) => {
          const selected = value.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={`flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors ${
                selected
                  ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                  selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40 bg-background"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 truncate">{category}</span>
            </button>
          );
        })}
      </div>

      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customSelected.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-600/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
            >
              <span className="max-w-[180px] truncate">{category}</span>
              <button type="button" onClick={() => toggleCategory(category)} className="hover:text-emerald-900" aria-label={`Remove ${category}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add custom category"
          className="h-10 flex-1 text-sm"
        />
        <ButtonLike onClick={addCustom} disabled={!customInput.trim()} />
      </div>

      {value.length === 0 && <p className="text-[11px] text-destructive">Select at least one category.</p>}
    </div>
  );
}

function ButtonLike({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-3 text-sm font-medium text-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="h-4 w-4" />
      Add
    </button>
  );
}

