"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadProgressBarProps {
  uploading: boolean;
  progress: number;
  error?: string | null;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export default function UploadProgressBar({
  uploading,
  progress,
  error,
  label,
  className,
  showLabel = true,
}: UploadProgressBarProps) {
  if (!uploading && !error) return null;

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {uploading && <Loader2 className="h-3 w-3 animate-spin text-brand" />}
            <span className="text-[10px] text-muted-foreground">
              {error ? "Upload failed" : label || `Uploading... ${Math.round(progress)}%`}
            </span>
          </div>
          {uploading && (
            <span className="text-[10px] font-medium text-brand">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            error ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${error ? 100 : progress}%` }}
        />
      </div>
    </div>
  );
}
