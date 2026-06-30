interface PageMainProps {
  children: React.ReactNode;
  className?: string;
}

export function PageMain({ children, className = "" }: PageMainProps) {
  return (
    <main className={`flex-1 px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full ${className}`}>
      {children}
    </main>
  );
}
