import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { userErrorMessage } from "@/lib/api-client";

interface UseInlineEditOptions<T> {
  initial: () => T;
  onSave: (value: T) => void | Promise<void>;
  errorFallback: string;
  validate?: (value: T) => string | null;
  isEqual?: (a: T, b: T) => boolean;
  disabled?: boolean;
}

const trimStrings = (_key: string, v: unknown) => (typeof v === "string" ? v.trim() : v);
const isSameValue = <T>(a: T, b: T) =>
  JSON.stringify(a, trimStrings) === JSON.stringify(b, trimStrings);

export function handleInlineEditKeyDown(
  e: KeyboardEvent<HTMLElement>,
  save: () => void,
  cancel: () => void,
) {
  if (e.nativeEvent.isComposing) return;
  if (e.key === "Enter") {
    e.preventDefault();
    save();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }
}

export function useInlineEdit<T>({
  initial,
  onSave,
  errorFallback,
  validate,
  isEqual = isSameValue,
  disabled = false,
}: UseInlineEditOptions<T>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  const registerTrigger = useCallback((el: HTMLButtonElement | null) => {
    trigger.current = el;
  }, []);

  useEffect(() => {
    if (wasEditing.current && !editing) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const start = () => {
    setValue(initial());
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (saving || disabled) return;
    const invalid = validate?.(value) ?? null;
    if (invalid) {
      setError(invalid);
      return;
    }
    if (isEqual(value, initial())) {
      setError(null);
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      setError(userErrorMessage(err, errorFallback));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) =>
    handleInlineEditKeyDown(e, () => void save(), cancel);

  return {
    editing,
    value,
    setValue,
    start,
    cancel,
    save,
    saving,
    error,
    registerTrigger,
    handleKeyDown,
  };
}
