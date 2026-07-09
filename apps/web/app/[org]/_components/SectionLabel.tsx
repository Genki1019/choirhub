export function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-3">
      {icon}
      {label}
    </div>
  );
}
