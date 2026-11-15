"use client";

import { Check, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { Theme } from "@/lib/theme";

const OPTIONS: Array<{
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Mustard & blue (default)",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Original navy theme",
    icon: Moon,
  },
];

/** Two-up appearance picker, used on the settings screens. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("grid grid-cols-2 gap-2", className)}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <option.icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-brand" : "text-muted-foreground"
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {option.description}
              </span>
            </span>
            {active && <Check className="ml-auto h-4 w-4 shrink-0 text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/** Compact row variant for the settings modal / inline panels. */
export function ThemeToggleRow() {
  const { theme, setTheme } = useTheme();
  const active = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0];

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <active.icon className="h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <span className="block text-sm font-medium">Appearance</span>
          <p className="text-[10px] text-muted-foreground truncate">
            {active.description}
          </p>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Colour theme"
        className="flex shrink-0 rounded-full bg-muted p-0.5"
      >
        {OPTIONS.map((option) => {
          const isActive = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={option.label}
              onClick={() => setTheme(option.value)}
              className={cn(
                "rounded-full p-1.5 transition-colors",
                isActive
                  ? "bg-background text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <option.icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
