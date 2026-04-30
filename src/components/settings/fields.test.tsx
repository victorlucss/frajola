import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleField, SelectField } from "./fields";

describe("ToggleField", () => {
  it("renders the label and description", () => {
    render(
      <ToggleField
        label="Enable thing"
        description="A thing that does stuff"
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Enable thing")).toBeInTheDocument();
    expect(screen.getByText("A thing that does stuff")).toBeInTheDocument();
  });

  it("invokes onChange with the inverted value when clicked", async () => {
    const onChange = vi.fn();
    render(<ToggleField label="X" checked={false} onChange={onChange} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("aria-checked", "false");
    await userEvent.click(switchEl);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reflects the checked state in aria-checked", () => {
    render(<ToggleField label="X" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});

describe("SelectField", () => {
  it("renders all provided options and the current value", () => {
    render(
      <SelectField
        label="Theme"
        value="dark"
        options={[
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("dark");
    expect(screen.getByRole("option", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dark" })).toBeInTheDocument();
  });

  it("calls onChange with the new value on selection", async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        label="Theme"
        value="system"
        options={[
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "dark");
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});
