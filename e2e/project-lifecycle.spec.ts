import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("ProjectSetu practical project lifecycle", () => {
  test("health and readiness report application and database status", async ({
    request,
  }) => {
    const healthResponse = await request.get("/api/health");
    expect(healthResponse.status()).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      status: "healthy",
      version: "0.1.0",
    });

    const readyResponse = await request.get("/api/ready");
    expect(readyResponse.status()).toBe(200);
    await expect(readyResponse.json()).resolves.toMatchObject({
      status: "ready",
      database: "connected",
    });
  });

  test("unauthenticated product and admin routes redirect to sign in", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Sign In to ProjectSetu" }),
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a new user completes, reports, downloads, and reopens a practical project", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const uniqueEmail = `project-owner-${Date.now()}@example.test`;
    const projectName = `Mahalakshmi Foods ${Date.now()}`;

    await page.goto("/login");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.locator('input[type="text"]').fill("Anita Deshmukh");
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').fill("ProjectSetu!2026");
    await page.getByRole("button", { name: /Create Account →/ }).click();

    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').fill("ProjectSetu!2026");
    await page.getByRole("button", { name: /Sign In →/ }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Project Workspace & DPR Portfolio" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "+ Create First Project", exact: true })
      .click();
    const fieldFor = (label: string) =>
      page
        .getByText(label, { exact: true })
        .locator("..")
        .locator("input, textarea");
    await fieldFor("Project / Enterprise Name *").fill(projectName);
    await fieldFor("Business / Enterprise Name").fill("Mahalakshmi Foods");
    await fieldFor("Promoter / Applicant Name").fill("Anita Deshmukh");
    await fieldFor("Sector Activity").fill("Millet food processing");
    await fieldFor("State").fill("Maharashtra");
    await fieldFor("District").fill("Nashik");
    await fieldFor("Brief Project Description").fill(
      "A proposed unit producing packaged millet snacks for regional retailers.",
    );
    await page.getByRole("button", { name: /Create Project/ }).click();

    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+$/);
    await expect(
      page.getByRole("heading", {
        name: "Step 1: Project Identity & Location",
      }),
    ).toBeVisible();
    await expect(page.locator('input[type="text"]').first()).toHaveValue(
      projectName,
    );

    for (let step = 1; step < 5; step += 1) {
      if (step === 2)
        await fieldFor("Lead Promoter / Contact Name *").fill(
          "Anita Deshmukh — test applicant",
        );
      await page.getByRole("button", { name: "Next Step →" }).click();
    }

    await expect(page.getByText("No sales lines added yet.")).toBeVisible();
    await expect(
      page.getByText("No operating expenses added yet."),
    ).toBeVisible();

    await page.getByRole("button", { name: "← Previous Step" }).click();
    await expect(
      page.getByRole("heading", { name: "Step 4: Means of Finance" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "← Previous Step" }).click();
    await expect(
      page.getByRole("heading", { name: "Step 3: Project Cost Breakdown" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "+ Add Cost Manually" }).click();
    await page.getByRole("button", { name: "+ Add Cost Manually" }).click();
    const secondCost = page.locator("table tbody tr").nth(1);
    await secondCost.locator("input").nth(0).fill("Packing equipment");
    await secondCost.locator("input").nth(1).fill("100000");
    const costRow = page.locator("table tbody tr").first();
    await costRow.locator("input").nth(0).fill("Food processing equipment");
    await costRow.locator("input").nth(1).fill("400000");

    await page.getByRole("button", { name: "Next Step →" }).click();
    await page.getByRole("button", { name: "+ Add Financing Source" }).click();
    await page.getByRole("button", { name: "+ Add Financing Source" }).click();
    const financeRows = page.locator("table tbody tr");
    const promoterFinance = financeRows.nth(0);
    await promoterFinance.locator("input").nth(0).fill("Promoter contribution");
    await promoterFinance.locator("input").nth(1).fill("125000");
    const termLoanFinance = financeRows.nth(1);
    await termLoanFinance.locator("input").nth(0).fill("Bank term loan");
    await termLoanFinance.locator("select").selectOption("TERM_LOAN");
    await termLoanFinance.locator("input").nth(1).fill("375000");

    await page.getByRole("button", { name: "Next Step →" }).click();
    await page.getByRole("button", { name: "+ Add Product Line" }).click();
    await page.getByRole("button", { name: "+ Add Product Line" }).click();
    const productRows = page.locator("table").nth(0).locator("tbody tr");
    for (const [index, values] of [
      ["Millet snack packs", "packs", "20000", "40", "60", "8", "4"],
      ["Millet flour", "kg", "12000", "55", "50", "6", "3"],
    ].entries()) {
      const inputs = productRows.nth(index).locator("input");
      for (const [inputIndex, value] of values.entries()) {
        await inputs.nth(inputIndex).fill(value);
      }
    }

    await page.getByRole("button", { name: "+ Add Expense Line" }).click();
    await page.getByRole("button", { name: "+ Add Expense Line" }).click();
    const expenseRows = page.locator("table").nth(1).locator("tbody tr");
    const materialRow = expenseRows.nth(0);
    await materialRow.locator("input").nth(0).fill("Raw millet and packaging");
    await materialRow.locator("input").nth(1).fill("45");
    const wagesRow = expenseRows.nth(1);
    await wagesRow.locator("input").nth(0).fill("Production wages");
    await wagesRow.locator("select").nth(0).selectOption("WAGES");
    await wagesRow.locator("select").nth(1).selectOption("FIXED_ANNUAL_AMOUNT");
    await wagesRow.locator("input").nth(1).fill("240000");
    await wagesRow.locator("input").nth(2).fill("5");

    await page.getByRole("button", { name: "Next Step →" }).click();
    await page.getByRole("button", { name: "Next Step →" }).click();
    await fieldFor("Total Sanctioned Principal (₹) *").fill("375000");
    await fieldFor("Annual Interest Rate (%) *").fill("10");
    await fieldFor("Repayment Tenure (Years) *").fill("5");
    await page.getByRole("button", { name: "Next Step →" }).click();
    await page.getByRole("button", { name: "Next Step →" }).click();

    await page
      .getByRole("button", { name: /Run Calculation/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Step 10: Financial Statements & Feasibility Results",
      }),
    ).toBeVisible();
    await expect(page.getByText("Detailed Project Report")).toBeVisible();

    await page.getByRole("button", { name: "Preview DPR" }).click();
    await expect(page.getByText(/sections/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate DPR" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Generate DPR" }).click();
    await expect(page.getByRole("status")).toContainText(
      "DPR Version 1 is ready",
    );

    const originalArtifacts = new Map<string, Buffer>();
    for (const label of ["PDF", "Word", "Excel"]) {
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: label, exact: true })
        .first()
        .click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toMatch(/^[a-zA-Z0-9_.-]+$/);
      const content = await readFile((await download.path())!);
      expect(content.length).toBeGreaterThan(1000);
      originalArtifacts.set(label, content);
    }

    await page.reload();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();
    const repeatDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "PDF", exact: true })
      .first()
      .click();
    expect(await (await repeatDownload).path()).toBeTruthy();

    await page.goto("/");
    await page.getByText(projectName, { exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+$/);
    await expect(
      page.getByRole("heading", {
        name: "Step 10: Financial Statements & Feasibility Results",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Sales & Costs/ }).click();
    await expect(
      page.locator('input[value="Millet snack packs"]'),
    ).toBeVisible();
    await page
      .locator("table")
      .first()
      .locator("tbody tr")
      .first()
      .locator("input")
      .nth(3)
      .fill("45");
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page.getByText("✓ Draft Saved")).toBeVisible();
    await page.getByRole("button", { name: /Results & DPR/ }).click();
    await expect(
      page.getByRole("heading", { name: "No Calculation Run Yet" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Step 1: Project Identity & Location",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Run Calculation/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Step 10: Financial Statements & Feasibility Results",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Preview DPR" }).click();
    await expect(
      page.getByRole("button", { name: "Generate DPR" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Generate DPR" }).click();
    await expect(page.getByRole("status")).toContainText(
      "DPR Version 2 is ready",
    );
    const v1 = page
      .locator("tr")
      .filter({ has: page.getByText("v1", { exact: true }) });
    for (const label of ["PDF", "Word", "Excel"]) {
      const downloadPromise = page.waitForEvent("download");
      await v1.getByRole("button", { name: label, exact: true }).click();
      const download = await downloadPromise;
      expect(await readFile((await download.path())!)).toEqual(
        originalArtifacts.get(label),
      );
    }
  });
});
