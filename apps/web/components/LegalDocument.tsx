interface LegalDocumentProps {
  title: string;
  establishedOn: string;
  children: React.ReactNode;
}

export function LegalDocument({ title, establishedOn, children }: LegalDocumentProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-sm leading-relaxed text-gray-700 sm:px-10">
      <h1 className="mb-8 text-xl font-bold text-gray-900">{title}</h1>
      <div className="space-y-8">{children}</div>
      <p className="mt-10 text-right text-xs text-gray-400">制定日: {establishedOn}</p>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function LegalWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700">
      {children}
    </p>
  );
}
