"use client";

import { useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { useHoverPinPopover } from "@/lib/useHoverPinPopover";

interface RolePermissionPopoverProps {
  roles: { value: string; label: string; description: string }[];
}

export function RolePermissionPopover({ roles }: RolePermissionPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isOpen, containerProps, triggerProps, close } = useHoverPinPopover(containerRef);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  return (
    <div className="relative inline-flex" ref={containerRef} {...containerProps}>
      <button
        type="button"
        aria-label="ロールの権限を表示"
        className="text-gray-400 transition-colors hover:text-gray-600"
        {...triggerProps}
      >
        <HelpCircle size={14} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1.5 w-64 space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg">
          {roles.map(({ value, label, description }) => (
            <div key={value}>
              <p className="font-semibold text-gray-800">{label}</p>
              <p>{description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
