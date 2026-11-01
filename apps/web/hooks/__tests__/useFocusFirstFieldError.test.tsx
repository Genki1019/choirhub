import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldError, fieldErrorProps } from "@/components/FieldError";
import { useFocusFirstFieldError } from "../useFocusFirstFieldError";

const schema = z.object({
  name: z.string().min(1, "お名前を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください"),
});
type Input = z.infer<typeof schema>;

function TestForm({ onValid = vi.fn() }: { onValid?: (data: Input) => void }) {
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, submitCount },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
    shouldFocusError: false,
  });
  useFocusFirstFieldError(errors, submitCount, setFocus);

  return (
    <form noValidate onSubmit={handleSubmit(onValid)}>
      <label htmlFor="name">お名前</label>
      <input
        id="name"
        {...register("name")}
        {...fieldErrorProps("name-error", errors.name?.message)}
      />
      <FieldError id="name-error">{errors.name?.message}</FieldError>
      <label htmlFor="email">メールアドレス</label>
      <input
        id="email"
        {...register("email")}
        {...fieldErrorProps("email-error", errors.email?.message)}
      />
      <FieldError id="email-error">{errors.email?.message}</FieldError>
      <button type="submit">送信</button>
    </form>
  );
}

describe("useFocusFirstFieldError", () => {
  it("送信で誤りがあれば、最初の誤りの欄にフォーカスを移す", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(await screen.findByText("お名前を入力してください")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("お名前")).toHaveFocus());
  });

  it("フォーカスが移った瞬間に、欄にはもうエラーの説明と aria-invalid が付いている", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    const name = screen.getByLabelText("お名前");
    const atFocus: { invalid: string | null; describedBy: string | null }[] = [];
    name.addEventListener("focus", () =>
      atFocus.push({
        invalid: name.getAttribute("aria-invalid"),
        describedBy: name.getAttribute("aria-describedby"),
      }),
    );

    await user.click(screen.getByRole("button", { name: "送信" }));
    await waitFor(() => expect(name).toHaveFocus());

    expect(atFocus).toEqual([{ invalid: "true", describedBy: "name-error" }]);
  });

  it("最初の欄が正しければ、次の誤りの欄にフォーカスを移す", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    await user.type(screen.getByLabelText("お名前"), "山田");
    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(await screen.findByText("有効なメールアドレスを入力してください")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("メールアドレス")).toHaveFocus());
  });

  it("送信のあと入力を直している間は、フォーカスを動かさない", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "送信" }));
    await waitFor(() => expect(screen.getByLabelText("お名前")).toHaveFocus());
    await user.click(screen.getByLabelText("メールアドレス"));
    await user.type(screen.getByLabelText("メールアドレス"), "a");

    expect(screen.getByLabelText("メールアドレス")).toHaveFocus();
  });

  it("誤りがなければフォーカスを動かさない", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    await user.type(screen.getByLabelText("お名前"), "山田");
    await user.type(screen.getByLabelText("メールアドレス"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(onValid).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "送信" })).toHaveFocus();
  });
});
