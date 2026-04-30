import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

import GeneralSettings from "./GeneralSettings";
import { invoke } from "../../lib/tauri";

const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe("GeneralSettings", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "list_audio_devices") {
        return [
          { id: "mic-a", name: "Built-in Mic", is_default: true, device_type: "input" },
          { id: "mic-b", name: "USB Headset", is_default: false, device_type: "input" },
          { id: "out", name: "Speakers", is_default: false, device_type: "output" },
        ];
      }
      return null;
    });
  });

  function renderWithSettings(initial: Record<string, string> = {}) {
    const updateSetting = vi.fn(async () => {});
    const getSetting = (k: string) => initial[k];
    render(
      <GeneralSettings getSetting={getSetting} updateSetting={updateSetting} />,
    );
    return { updateSetting };
  }

  it("renders Theme and Microphone selects, Meeting-pill toggle, and lists input devices only", async () => {
    renderWithSettings({ theme: "dark", show_meeting_pill: "1" });

    expect(screen.getByLabelText("Theme")).toBeInTheDocument();

    await waitFor(() => {
      // Default option + 2 input devices = 3 options.
      const micSelect = screen.getByLabelText("Microphone") as HTMLSelectElement;
      expect(micSelect.options).toHaveLength(3);
    });

    // System-default option references the default mic.
    expect(
      screen.getByRole("option", { name: /System default \(Built-in Mic\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "USB Headset" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Speakers" })).toBeNull();

    expect(
      screen.getByText("Show Frajola pill for meetings"),
    ).toBeInTheDocument();
  });

  it("persists meeting-pill toggle changes", async () => {
    const { updateSetting } = renderWithSettings({ show_meeting_pill: "1" });
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);
    expect(updateSetting).toHaveBeenCalledWith("show_meeting_pill", "0");
  });
});
