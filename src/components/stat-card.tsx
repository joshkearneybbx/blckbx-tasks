"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  percentage?: number;
  subtitle?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, percentage, subtitle, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-blckbx-sand-dark/50 rounded-xl px-6 py-5 h-full border shadow-sm text-left w-full transition-all",
        isActive
          ? "border-blckbx-black ring-2 ring-blckbx-black/20"
          : "border-blckbx-black/10 hover:border-blckbx-black/30 hover:shadow-md"
      )}
    >
      <p className="text-xs text-blckbx-black/60 uppercase tracking-wider font-medium">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="text-4xl font-medium text-blckbx-black">{value}</p>
        {percentage !== undefined && (
          <span className="text-sm text-blckbx-black/50">
            ({percentage.toFixed(0)}%)
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-blckbx-black/50 mt-1">{subtitle}</p>
      )}
    </button>
  );
}
