"use client";

interface StepperProps {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

export function Stepper({ label, value, disabled, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-gray-100 disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          disabled={disabled}
          className="focus:ring-brand-400 w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-gray-100 disabled:opacity-40"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
