import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { userErrorMessage } from "@/lib/api-client";
import { fieldErrorProps } from "@/components/FieldError";

export type InlineEditValidation = string | { message: string; fields: string[] } | null;

interface UseInlineEditOptions<T> {
  initial: () => T;
  onSave: (value: T) => void | Promise<void>;
  errorFallback: string;
  validate?: (value: T) => InlineEditValidation;
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
  const [invalid, setInvalid] = useState<{ fields?: string[] } | null>(null);
  const errorId = useId();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  const registerTrigger = useCallback((el: HTMLButtonElement | null) => {
    trigger.current = el;
  }, []);

  useEffect(() => {
    if (wasEditing.current && !editing) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const showError = (message: string | null, nextInvalid: { fields?: string[] } | null = null) => {
    setError(message);
    setInvalid(nextInvalid);
  };

  const start = () => {
    setValue(initial());
    showError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;
    showError(null);
    setEditing(false);
  };

  const save = async () => {
    if (saving || disabled) return;
    const result = validate?.(value) ?? null;
    if (result) {
      if (typeof result === "string") showError(result, {});
      else showError(result.message, { fields: result.fields });
      return;
    }
    if (isEqual(value, initial())) {
      showError(null);
      setEditing(false);
      return;
    }
    setSaving(true);
    showError(null);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      showError(userErrorMessage(err, errorFallback));
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (field?: string) =>
    fieldErrorProps(
      errorId,
      error,
      !!invalid && (!invalid.fields || (!!field && invalid.fields.includes(field))),
    );

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
    errorId,
    fieldProps,
    registerTrigger,
    handleKeyDown,
  };
}
