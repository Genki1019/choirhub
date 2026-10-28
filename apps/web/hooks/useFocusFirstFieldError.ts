import { useEffect, useRef } from "react";
import type { FieldErrors, FieldValues, Path, UseFormSetFocus } from "react-hook-form";

export function useFocusFirstFieldError<T extends FieldValues>(
  errors: FieldErrors<T>,
  submitCount: number,
  setFocus: UseFormSetFocus<T>,
) {
  const handledSubmitCount = useRef(submitCount);

  useEffect(() => {
    if (submitCount === handledSubmitCount.current) return;
    handledSubmitCount.current = submitCount;
    const first = Object.keys(errors).find((name) => name !== "root");
    if (first) setFocus(first as Path<T>);
  }, [errors, submitCount, setFocus]);
}
