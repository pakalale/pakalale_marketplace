"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AnimatedSearchProps {
  placeholder?: string;
  className?: string;
  onClick?: () => void;
}

export default function AnimatedSearch({
  placeholder = "Search here....",
  className = "",
  onClick,
}: AnimatedSearchProps) {
  const [typedPlaceholder, setTypedPlaceholder] = useState("");

  useEffect(() => {
    const prompts = [placeholder, "Search local shops...", "Find products near you..."];
    let promptIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer: number;

    const typeNextCharacter = () => {
      const prompt = prompts[promptIndex];
      characterIndex += deleting ? -1 : 1;
      setTypedPlaceholder(prompt.slice(0, characterIndex));

      if (!deleting && characterIndex === prompt.length) {
        deleting = true;
        timer = window.setTimeout(typeNextCharacter, 1100);
        return;
      }

      if (deleting && characterIndex === 0) {
        deleting = false;
        promptIndex = (promptIndex + 1) % prompts.length;
        timer = window.setTimeout(typeNextCharacter, 300);
        return;
      }

      timer = window.setTimeout(typeNextCharacter, deleting ? 45 : 75);
    };

    timer = window.setTimeout(typeNextCharacter, 350);
    return () => window.clearTimeout(timer);
  }, [placeholder]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        aria-label="Search products and local shops"
        placeholder={typedPlaceholder || "Search products..."}
        className="h-10 cursor-pointer rounded-full border-border bg-muted/50 pl-10 pr-4 text-sm placeholder:text-muted-foreground sm:h-11"
        onClick={onClick}
        readOnly
      />
    </div>
  );
}
