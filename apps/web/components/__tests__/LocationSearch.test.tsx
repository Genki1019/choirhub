import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationSearch } from "../LocationSearch";

const placeResults = {
  results: [
    {
      id: "place-1",
      name: "○○文化センター",
      address: "東京都○○区1-2-3",
      mapUrl: "https://maps.example.com/1",
    },
  ],
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// LocationSearch は value を親が管理する制御コンポーネントなので、
// テストでは実際に入力値を反映するラッパーで包む
function ControlledLocationSearch({
  onChangeName,
  onSelectPlace,
}: {
  onChangeName: (name: string) => void;
  onSelectPlace: (name: string, url: string) => void;
}) {
  const [value, setValue] = useState("");
  const [mapUrl, setMapUrl] = useState<string | undefined>(undefined);
  return (
    <LocationSearch
      value={value}
      mapUrl={mapUrl}
      onChangeName={(name) => {
        setValue(name);
        setMapUrl(undefined);
        onChangeName(name);
      }}
      onSelectPlace={(name, url) => {
        setValue(name);
        setMapUrl(url);
        onSelectPlace(name, url);
      }}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocationSearch（検索・デバウンス）", () => {
  it("2文字未満の入力では検索しない", async () => {
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "a");
    await sleep(600);

    expect(fetch).not.toHaveBeenCalled();
  }, 10000);

  it("2文字以上入力すると400ms後にfetchが呼ばれ、候補が表示される", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve(placeResults),
    } as Response);
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "文化");

    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalledWith("/api/places?q=%E6%96%87%E5%8C%96");
      },
      { timeout: 2000 },
    );
    expect(await screen.findByText("○○文化センター")).toBeInTheDocument();
    expect(screen.getByText("東京都○○区1-2-3")).toBeInTheDocument();
  }, 10000);

  it("短時間の連続入力はデバウンスされ、最後の入力から400ms後に1回だけfetchされる", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve(placeResults),
    } as Response);
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "文");
    await sleep(200);
    await user.type(input, "化");

    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  }, 10000);

  it("検索中はローディングスピナーを表示する", async () => {
    let resolveFetch: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "文化");

    await waitFor(
      () => {
        expect(document.querySelector(".animate-spin")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    resolveFetch!({ json: () => Promise.resolve(placeResults) } as Response);
    await screen.findByText("○○文化センター");
  }, 10000);

  it("fetch失敗時は候補を表示しない", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "文化");
    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
    await sleep(100);

    expect(screen.queryByText("○○文化センター")).not.toBeInTheDocument();
  }, 10000);
});

describe("LocationSearch（選択・表示）", () => {
  it("入力するとonChangeNameが呼ばれる", async () => {
    const onChangeName = vi.fn();
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={onChangeName} onSelectPlace={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "a");
    expect(onChangeName).toHaveBeenCalledWith("a");
  });

  it("候補クリックでonSelectPlaceが呼ばれ、ドロップダウンが閉じる", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve(placeResults),
    } as Response);
    const onSelectPlace = vi.fn();
    const user = userEvent.setup();
    render(<ControlledLocationSearch onChangeName={vi.fn()} onSelectPlace={onSelectPlace} />);

    await user.type(screen.getByRole("textbox"), "文化");
    const suggestion = await screen.findByText("○○文化センター", undefined, { timeout: 2000 });

    await user.click(suggestion);

    expect(onSelectPlace).toHaveBeenCalledWith("○○文化センター", "https://maps.example.com/1");
    expect(screen.queryByText("○○文化センター")).not.toBeInTheDocument();
  }, 10000);

  it("mapUrlが無い場合: 「Googleマップで開く」リンクを表示しない", () => {
    render(<LocationSearch value="○○公民館" onChangeName={vi.fn()} onSelectPlace={vi.fn()} />);
    expect(screen.queryByText("Google マップで開く")).not.toBeInTheDocument();
  });

  it("mapUrlがある場合: 「Googleマップで開く」リンクを表示する", () => {
    render(
      <LocationSearch
        value="○○公民館"
        mapUrl="https://maps.example.com/1"
        onChangeName={vi.fn()}
        onSelectPlace={vi.fn()}
      />,
    );
    const link = screen.getByText("Google マップで開く").closest("a");
    expect(link).toHaveAttribute("href", "https://maps.example.com/1");
  });
});
