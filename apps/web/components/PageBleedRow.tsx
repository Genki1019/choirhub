interface PageBleedRowProps {
  children: React.ReactNode;
  className?: string;
}

export function PageBleedRow({ children, className = "" }: PageBleedRowProps) {
  return (
    <div className={`max-w-7xl mx-auto w-full px-4 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}
