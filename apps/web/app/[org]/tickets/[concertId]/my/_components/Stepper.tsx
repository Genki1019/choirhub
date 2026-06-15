"use client";

interface StepperProps {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

export function Stepper({ label, value, disabled, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          disabled={disabled}
          className="w-14 text-center text-sm font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
