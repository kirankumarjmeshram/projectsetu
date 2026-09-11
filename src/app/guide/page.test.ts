import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => ({ id: "guide-user", role: "USER" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import GuidePage from "./page";

describe("user guide", () => {
  it("renders entrepreneur guidance and validation/download distinctions", async () => {
    const html = renderToStaticMarkup(await GuidePage());
    expect(html).toContain("User Guide");
    expect(html).toContain("Download Anyway");
    expect(html).toContain("DSCR");
    expect(html).toContain("does not certify");
  });
});
