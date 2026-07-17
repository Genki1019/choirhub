import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsLayout from "../layout";
import { MemberProvider } from "@/contexts/MemberContext";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ replace }),
}));

function renderLayout(roles: string[]) {
  return render(
    <MemberProvider memberId="member-self" roles={roles}>
      <SettingsLayout>
        <div>設定コンテンツ</div>
      </SettingsLayout>
    </MemberProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SettingsLayout", () => {
  it("adminの場合は子要素を表示する", () => {
    renderLayout(["admin"]);
    expect(screen.getByText("設定コンテンツ")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("financeの場合は子要素を表示する", () => {
    renderLayout(["finance"]);
    expect(screen.getByText("設定コンテンツ")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("admin・finance以外の場合は子要素を表示せず団体トップへリダイレクトする", () => {
    renderLayout(["member"]);
    expect(screen.queryByText("設定コンテンツ")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir");
  });
});
