"use client";

import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PREDEFINED_SPECIALTIES = [
  "Electronics", "Mobile Phones", "Laptops", "Accessories",
  "Fashion", "Clothing", "Shoes", "Bags",
  "Fresh Food", "Fruits", "Vegetables", "Grains", "Dairy",
  "Furniture", "Home Decor", "Appliances", "Kitchenware",
  "Gaming", "Consoles", "PC Gaming",
  "Pharmacy", "Health", "Baby Care", "Wellness", "Skincare",
  "Crafts", "Textiles", "Household Items",
  "Sports", "Fitness", "Outdoor",
  "Books", "Stationery", "Education",
  "Automotive", "Spare Parts", "Tools",
  "Beauty", "Hair Care", "Cosmetics",
  "Flowers", "Gifts", "Cards",
  "Restaurant", "Food Delivery", "Catering",
  "Services", "Repair", "Printing",
];

interface SpecialtyPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function SpecialtyPicker({ value, onChange }: SpecialtyPickerProps) {
  const [customInput, setCustomInput] = useState("");

  const toggleSpecialty = (specialty: string) => {
    if (value.includes(specialty)) {
      onChange(value.filter((s) => s !== specialty));
    } else {
      onChange([...value, specialty]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setCustomInput("");
    }
  };

  const removeSpecialty = (specialty: string) => {
    onChange(value.filter((s) => s !== specialty));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  // Show predefined that aren't selected, plus any custom ones in the list
  const availablePredefined = PREDEFINED_SPECIALTIES.filter((s) => !value.includes(s));
  const customSelected = value.filter((s) => !PREDEFINED_SPECIALTIES.includes(s));

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((specialty) => (
            <span
              key={specialty}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-brand text-[11px] font-medium rounded-full"
            >
              {specialty}
              <button type="button" onClick={() => removeSpecialty(specialty)} className="hover:text-brand/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Predefined options */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5">Tap to select:</p>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {availablePredefined.map((specialty) => (
            <button
              key={specialty}
              type="button"
              onClick={() => toggleSpecialty(specialty)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 text-[11px] rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              {specialty}
            </button>
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add custom category..."
          className="h-9 text-xs flex-1"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="h-9 px-3 bg-muted hover:bg-muted/80 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />Add
        </button>
      </div>

      {value.length === 0 && (
        <p className="text-[10px] text-destructive">Select at least one specialty</p>
      )}
    </div>
  );
}
