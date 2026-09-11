import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { FIELD_HELP, FieldHelp } from "./field-help";

describe("FieldHelp", () => {
  it("renders reusable keyboard-accessible help from structured metadata", () => {
    const html = renderToStaticMarkup(
      createElement(FieldHelp, { topic: "workingCapital" }),
    );

    expect(Object.keys(FIELD_HELP)).toHaveLength(9);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain('aria-label="Help: workingCapital"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("day-to-day operations");
  });
});
