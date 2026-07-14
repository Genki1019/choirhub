export function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600">
      {icon}
      {label}
    </div>
  );
}
