import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarFeedModal } from "../CalendarFeedModal";
import { eventsApi } from "@/lib/events-api";

vi.mock("@/lib/events-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/events-api")>("@/lib/events-api");
  return {
    ...actual,
    eventsApi: {
      getCalendarFeedToken: vi.fn(),
      regenerateCalendarFeedToken: vi.fn(),
    },
  };
});

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarFeedModal orgSlug="tokyo-men-choir" onClose={onClose} />
    </QueryClientProvider>,
  );
}

function stubClipboard() {
  if (navigator.clipboard) {
    return vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  }
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

beforeEach(() => {
  vi.resetAllMocks();
  stubClipboard();
});

describe("CalendarFeedModal", () => {
  it("未発行の場合は「発行する」ボタンのみ表示し、URL欄・連携ボタンは表示しない", async () => {
    vi.mocked(eventsApi.getCalendarFeedToken).mockResolvedValue({ token: null });
    renderModal();

    expect(await screen.findByText("発行する")).toBeInTheDocument();
    expect(screen.queryByLabelText("URLをコピー")).not.toBeInTheDocument();
    expect(screen.queryByText("Googleカレンダーに追加")).not.toBeInTheDocument();
  });

  it("「発行する」押下でトークンが発行され、フィードURL・連携ボタンが表示される", async () => {
    vi.mocked(eventsApi.getCalendarFeedToken).mockResolvedValue({ token: null });
    vi.mocked(eventsApi.regenerateCalendarFeedToken).mockResolvedValue({ token: "new-token" });
    const user = userEvent.setup();
    renderModal();

    await screen.findByText("発行する");
    await user.click(screen.getByText("発行する"));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/feed\.ics\?token=new-token/)).toBeInTheDocument();
    });
    expect(screen.getByText("Googleカレンダーに追加")).toBeInTheDocument();
    expect(screen.getByLabelText("URLをコピー")).toBeInTheDocument();
    expect(screen.getByText("再発行する")).toBeInTheDocument();
  });

  it("発行済み時に「URLをコピー」を押すとフィードURLがクリップボードに書き込まれる", async () => {
    vi.mocked(eventsApi.getCalendarFeedToken).mockResolvedValue({ token: "existing-token" });
    const user = userEvent.setup();
    renderModal();

    await screen.findByDisplayValue(/feed\.ics\?token=existing-token/);
    await user.click(screen.getByLabelText("URLをコピー"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calendar/tokyo-men-choir/feed.ics?token=existing-token"),
    );
  });

  it("発行済み時に「再発行する」を押すと新しいトークンに基づくURLに切り替わる", async () => {
    vi.mocked(eventsApi.getCalendarFeedToken).mockResolvedValue({ token: "old-token" });
    vi.mocked(eventsApi.regenerateCalendarFeedToken).mockResolvedValue({
      token: "regenerated-token",
    });
    const user = userEvent.setup();
    renderModal();

    await screen.findByDisplayValue(/feed\.ics\?token=old-token/);
    await user.click(screen.getByText("再発行する"));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/feed\.ics\?token=regenerated-token/)).toBeInTheDocument();
    });
  });
});
