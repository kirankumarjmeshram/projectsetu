import { expect, test } from "@playwright/test";

test.describe("ProjectSetu Full Production & Auth Lifecycle E2E Suite", () => {
  test("Healthcheck Endpoint responds with healthy status and database connectivity", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.database).toBe("connected");
    expect(data.version).toBe("0.1.0");
    expect(typeof data.latencyMs).toBe("number");
  });

  test("Home page loads with branding, portfolio view, and Sign In trigger", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ProjectSetu/i);

    const brandHeading = page.locator("text=ProjectSetu");
    await expect(brandHeading.first()).toBeVisible();

    const signInBtn = page.getByRole("button", { name: /Sign In/i });
    await expect(signInBtn.first()).toBeVisible();
  });

  test("Dedicated Login page provides fast demo sign-in", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /Sign In to ProjectSetu/i }),
    ).toBeVisible();

    const demoEntrepreneurBtn = page.getByRole("button", {
      name: /👤 Entrepreneur/i,
    });
    const demoAdminBtn = page.getByRole("button", {
      name: /🛡️ Admin User/i,
    });

    await expect(demoEntrepreneurBtn).toBeVisible();
    await expect(demoAdminBtn).toBeVisible();
  });

  test("Admin Console requires ADMIN role", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*login.*/);
  });

  test("Entrepreneur Flow: Sign In and Portfolio Navigation", async ({
    page,
  }) => {
    await page.goto("/login");

    // Click demo Entrepreneur login
    const demoEntrepreneurBtn = page.getByRole("button", {
      name: /👤 Entrepreneur/i,
    });
    await demoEntrepreneurBtn.click();

    // Should redirect to home page and show user menu
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.locator("text=Kiran Sharma").first()).toBeVisible();
    await expect(page.locator("text=Entrepreneur").first()).toBeVisible();
  });

  test("Admin Flow: Sign In, Console Access, and Multi-tab Inspection", async ({
    page,
  }) => {
    await page.goto("/login");

    // Click demo Admin login
    const demoAdminBtn = page.getByRole("button", {
      name: /🛡️ Admin User/i,
    });
    await demoAdminBtn.click();

    // Redirect to home and verify Admin badge
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.locator("text=ProjectSetu Admin").first()).toBeVisible();

    // Navigate to Admin Console
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", {
        name: /Executive Operations & Tenant Portfolio Overview/i,
      }),
    ).toBeVisible();

    // Check Users tab
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: /User & Role Management/i }),
    ).toBeVisible();

    // Check Projects tab
    await page.goto("/admin/projects");
    await expect(
      page.getByRole("heading", {
        name: /Tenant Projects & Portfolio Explorer/i,
      }),
    ).toBeVisible();

    // Check Schemes tab
    await page.goto("/admin/schemes");
    await expect(
      page.getByRole("heading", {
        name: /Government Scheme & Program Registry/i,
      }),
    ).toBeVisible();

    // Check Audit Trail tab
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", {
        name: /Administrative Audit Trail & Access Logs/i,
      }),
    ).toBeVisible();

    // Check Diagnostics tab
    await page.goto("/admin/diagnostics");
    await expect(
      page.getByRole("heading", {
        name: /System Diagnostics & Runtime Telemetry/i,
      }),
    ).toBeVisible();
  });
});
