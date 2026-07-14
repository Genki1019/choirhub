interface PageBleedRowProps {
  children: React.ReactNode;
  className?: string;
}

export function PageBleedRow({ children, className = "" }: PageBleedRowProps) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-8 ${className}`}>{children}</div>;
}
