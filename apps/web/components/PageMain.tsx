interface PageMainProps {
  children: React.ReactNode;
  className?: string;
}

export function PageMain({ children, className = "" }: PageMainProps) {
  return (
    <main className={`mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 ${className}`}>
      {children}
    </main>
  );
}
