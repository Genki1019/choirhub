export function fieldErrorProps(
  errorId: string,
  error: string | null | undefined,
  invalid = !!error,
) {
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": error ? errorId : undefined,
  };
}

interface FieldErrorProps {
  id: string;
  children?: string | null;
}

export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {children}
    </p>
  );
}
