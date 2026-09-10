import type { ProjectInvestmentCashFlowPeriod } from "@/domain/investment-returns/investment-returns";
import type Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { ProjectSetuDecimal as D } from "@/domain/shared/decimal";
import { orchestrateProjectCalculation } from "./calculation-orchestrator";
import { professionalFixture } from "./testing/professional-fixture";
import { buildDprReportModel } from "@/lib/reports/builder";
import { validateDprReport } from "@/lib/reports/validation";
import { programId } from "@/domain/schemes/program";

const equal = (actual: string, expected: Decimal.Value) =>
  expect(new D(actual).minus(expected).abs().lt("1e-30")).toBe(true);
const result = (scheme = false) =>
  orchestrateProjectCalculation(professionalFixture(scheme), "2026-09-09");
async function model(input = professionalFixture()) {
  const calculation = orchestrateProjectCalculation(input, "2026-09-09");
  return buildDprReportModel({
    project: input,
    calculation,
    identity: {
      reportId: "qa-report",
      reportVersion: 1,
      projectId: input.project.id,
      inputSnapshotId: "qa-input",
      calculationRunId: "qa-run",
      fundingSnapshotId: calculation.fundingComposer ? "qa-funding" : undefined,
      templateVersion: "BASE_BANKABLE_DPR/1.0",
      contentSchemaVersion: 1,
      generatedAt: "2026-09-09T00:00:00Z",
      language: "en",
    },
  });
}

describe("independent professional DPR fixture review", () => {
  it.each([false, true])(
    "reconciles all five projected accounting years (scheme=%s)",
    (scheme) => {
      const r = result(scheme);
      expect(r.success).toBe(true);
      equal(r.projectCost!.totalProjectCost, "1000000");
      equal(r.meansOfFinance!.totalMeansOfFinance, "1000000");
      let cash = new D(0),
        retained = new D(0),
        priorWc = new D(0);
      for (let i = 0; i < 5; i++) {
        // Independently derived from explicit applicant fixture quantities and rates.
        const revenue = new D(1500000)
          .mul(new D("1.05").pow(i))
          .mul(new D("1.03").pow(i));
        const materials = revenue.mul("0.4");
        const fixed = new D(360000).mul(new D("1.05").pow(i));
        const expenses = materials.plus(fixed),
          ebitda = revenue.minus(expenses);
        const interest = new D(600000).minus(new D(120000).mul(i)).mul("0.1");
        const pbt = ebitda.minus(80000).minus(interest),
          tax = D.max(pbt, 0).mul("0.25"),
          pat = pbt.minus(tax);
        const pnl = r.profitAndLoss!.years[i];
        for (const [actual, expected] of [
          [pnl.revenue, revenue],
          [pnl.operatingExpenses, expenses],
          [pnl.ebitda, ebitda],
          [pnl.depreciation, new D(80000)],
          [pnl.ebit, ebitda.minus(80000)],
          [pnl.interestExpense, interest],
          [pnl.profitBeforeTax, pbt],
          [pnl.taxExpense, tax],
          [pnl.profitAfterTax, pat],
        ] as const)
          equal(actual, expected);
        const wc = materials
          .mul(30)
          .div(360)
          .plus(expenses.mul(15).div(360))
          .plus(revenue.mul(30).div(360))
          .minus(materials.mul(15).div(360));
        equal(r.workingCapitalSummaries![i].workingCapitalGap, wc);
        equal(
          r.workingCapitalSummaries![i].borrowerContribution!,
          wc.mul("0.25"),
        );
        equal(
          r.workingCapitalSummaries![i].bankFinanceRequired!,
          wc.mul("0.75"),
        );
        const cf = r.cashFlow!.years[i];
        equal(
          cf.operatingCashFlow,
          pat.plus(80000).plus(interest).minus(wc.minus(priorWc)),
        );
        equal(cf.capitalExpenditure, i === 0 ? 800000 : 0);
        cash = cash
          .plus(pat)
          .plus(80000)
          .minus(wc.minus(priorWc))
          .minus(120000)
          .plus(i === 0 ? 200000 : 0);
        equal(cf.closingCash, cash);
        const loan = r.loanSchedule!.annualSummaries[i];
        equal(loan.principalRepaid, 120000);
        equal(loan.interestPaid, interest);
        equal(
          loan.closingPrincipal,
          new D(600000).minus(new D(120000).mul(i + 1)),
        );
        const dep = r.depreciation!.yearlySummaries[i];
        equal(
          dep.closingNetCarryingValue,
          new D(800000).minus(new D(80000).mul(i + 1)),
        );
        retained = retained.plus(pat);
        const bs = r.balanceSheet!.years[i];
        equal(bs.closingRetainedEarnings, retained);
        equal(bs.cashAndBank, cash);
        equal(bs.totalAssets, new D(bs.totalLiabilities).plus(bs.totalEquity));
        equal(
          new D(bs.longTermLoanOutstanding).plus(bs.currentDebt).toString(),
          loan.closingPrincipal,
        );
        const metrics = r.bankabilityMetrics!.years[i];
        for (const [metric, expected] of [
          [
            metrics.dscr,
            pat.plus(80000).plus(interest).div(interest.plus(120000)),
          ],
          [metrics.interestCoverageRatio, ebitda.minus(80000).div(interest)],
          [metrics.patMargin, pat.div(revenue).mul(100)],
          [metrics.breakEvenSales, fixed.div("0.6")],
          [
            metrics.currentRatio,
            new D(bs.totalCurrentAssets).div(bs.totalCurrentLiabilities),
          ],
          [
            metrics.debtEquityRatio,
            new D(loan.closingPrincipal).div(bs.totalEquity),
          ],
          [
            metrics.roce,
            ebitda
              .minus(80000)
              .div(new D(bs.totalAssets).minus(bs.totalCurrentLiabilities))
              .mul(100),
          ],
        ] as const) {
          expect(metric.status).toBe("DEFINED");
          if (metric.status === "DEFINED") equal(metric.value, expected);
        }
        priorWc = wc;
      }
    },
  );
  it("independently discounts return cash flows and verifies IRR root and payback", () => {
    const returns = result().investmentReturns!;
    const flows = returns.series.periods.map((p) => new D(p.cashFlow));
    equal(flows[0].toString(), -800000);
    equal(flows[1].toString(), 350000);
    const npv = (rate: Decimal) =>
      flows.reduce(
        (sum, flow, i) => sum.plus(flow.div(rate.plus(1).pow(i))),
        new D(0),
      );
    equal(returns.netPresentValue.npv, npv(new D("0.12")));
    const irr = returns.internalRateOfReturn.irr;
    expect(irr.status).toBe("DEFINED");
    if (irr.status === "DEFINED")
      expect(npv(new D(irr.value).div(100)).abs().lt("0.000001")).toBe(true);
    let cumulative = flows[0];
    for (let i = 1; i < flows.length; i++) {
      if (cumulative.isNegative() && cumulative.plus(flows[i]).gte(0)) {
        const payback = returns.simplePayback.paybackPeriod;
        expect(payback.status).toBe("DEFINED");
        if (payback.status === "DEFINED")
          equal(
            payback.value,
            new D(i - 1).plus(cumulative.neg().div(flows[i])),
          );
        break;
      }
      cumulative = cumulative.plus(flows[i]);
    }
    const pi = returns.profitabilityIndex.profitabilityIndex;
    expect(pi.status).toBe("DEFINED");
    if (pi.status === "DEFINED")
      equal(pi.value, npv(new D("0.12")).minus(flows[0]).div(flows[0].neg()));
  });
  it("exports a balanced no-scheme fixture and a conditional scheme fixture without inventing subsidy", async () => {
    for (const scheme of [false, true]) {
      const m = await model(professionalFixture(scheme));
      expect(validateDprReport(m).validForExport).toBe(true);
      expect(m.sections.some((s) => s.id === "scheme-assistance")).toBe(scheme);
      expect(JSON.stringify(m.disclaimer)).toMatch(
        /lender|appraisal|verification/i,
      );
      if (scheme)
        equal(
          m.calculation.fundingComposer!.summary.benefits
            .totalCalculatedCashBenefits,
          0,
        );
    }
  });
  it("blocks an unbalanced report and preserves unknown scheme facts for review", async () => {
    const m = await model();
    const invalid = {
      ...m,
      calculation: {
        ...m.calculation,
        balanceSheet: {
          ...m.calculation.balanceSheet!,
          years: m.calculation.balanceSheet!.years.map((y) => ({
            ...y,
            isBalanced: false,
          })),
        },
      },
    };
    expect(validateDprReport(invalid).validForExport).toBe(false);
    const fixture = professionalFixture(true);
    const unknown = orchestrateProjectCalculation(
      { ...fixture, schemeFacts: {} },
      "2026-09-09",
    );
    expect(JSON.stringify(unknown.fundingComposer)).toMatch(
      /UNKNOWN|MANUAL_REVIEW|UNRESOLVED/,
    );
  });
  it("does not silently approve unsupported convergence", () => {
    const input = professionalFixture(true);
    const r = orchestrateProjectCalculation(
      {
        ...input,
        selectedPrograms: [
          ...input.selectedPrograms,
          { programId: programId("GOI.PMFME.INDIVIDUAL_UNIT") },
        ],
      },
      "2026-09-09",
    );
    expect(JSON.stringify(r.fundingComposer)).toMatch(
      /MANUAL_REVIEW|UNRESOLVED|CONFLICT|UNKNOWN/,
    );
  });

  it.each([
    "zero-cost",
    "no-revenue",
    "finance-mismatch",
    "loan-mismatch",
    "unmodeled-cost",
    "unsupported-finance",
  ])("blocks incomplete financial report: %s", async (kind) => {
    const input = professionalFixture();
    const changed =
      kind === "zero-cost"
        ? { ...input, costItems: [] }
        : kind === "no-revenue"
          ? { ...input, revenueProducts: [] }
          : kind === "finance-mismatch"
            ? { ...input, financingSources: input.financingSources.slice(0, 1) }
            : kind === "loan-mismatch"
              ? { ...input, loan: { ...input.loan, principalAmount: "500000" } }
              : kind === "unmodeled-cost"
                ? {
                    ...input,
                    costItems: input.costItems.map((c, i) =>
                      i === 0 ? { ...c, category: "LAND" as const } : c,
                    ),
                    depreciableAssets: [],
                  }
                : {
                    ...input,
                    financingSources: input.financingSources.map((f, i) =>
                      i === 1 ? { ...f, type: "UNSECURED_LOAN" as const } : f,
                    ),
                  };
    expect(validateDprReport(await model(changed)).validForExport).toBe(false);
  });
});

describe("investment-return working-capital releases", () => {
  it.each(["increase", "decrease", "unchanged", "rise-fall"] as const)(
    "accounts for %s requirements and terminal recovery exactly once",
    (scenario) => {
      const input = professionalFixture();
      const growth =
        scenario === "increase" ? "5" : scenario === "decrease" ? "-5" : "0";
      const r = orchestrateProjectCalculation(
        {
          ...input,
          revenueProducts: input.revenueProducts.map((p, i) => ({
            ...p,
            annualQuantityGrowth:
              scenario === "rise-fall" ? (i === 0 ? "-30" : "50") : growth,
            annualPriceEscalation: "0",
          })),
          operatingExpenses: input.operatingExpenses.map((e) => ({
            ...e,
            annualEscalation: "0",
          })),
        },
        "2026-09-09",
      );
      expect(r.success).toBe(true);
      const periods = r.investmentReturns!.series
        .periods as readonly ProjectInvestmentCashFlowPeriod[];
      equal(periods[0].cashFlow, -800000);
      let previous = new D(0),
        netWc = new D(0);
      const deltas: Decimal[] = [];
      r.workingCapitalSummaries!.forEach((w, i) => {
        const balance = new D(w.workingCapitalGap),
          delta = balance.minus(previous);
        const terminal = i === 4 ? balance : new D(0);
        const component = periods[i + 1].components;
        equal(component.workingCapitalInvestment!.value, D.max(delta, 0));
        equal(
          component.workingCapitalRecovery!.value,
          D.max(delta.negated(), 0).plus(terminal),
        );
        equal(
          periods[i + 1].cashFlow,
          new D(r.profitAndLoss!.years[i].ebitda).minus(delta).plus(terminal),
        );
        netWc = netWc
          .plus(component.workingCapitalInvestment!.value)
          .minus(component.workingCapitalRecovery!.value);
        expect(r.balanceSheet!.years[i].isBalanced).toBe(true);
        if (i > 0) deltas.push(delta);
        previous = balance;
      });
      equal(netWc.toString(), 0);
      if (scenario === "increase")
        expect(deltas.every((d) => d.gt(0))).toBe(true);
      if (scenario === "decrease")
        expect(deltas.every((d) => d.lt(0))).toBe(true);
      if (scenario === "unchanged")
        expect(deltas.every((d) => d.isZero())).toBe(true);
      if (scenario === "rise-fall") {
        expect(deltas.some((d) => d.lt(0))).toBe(true);
        expect(deltas.some((d) => d.gt(0))).toBe(true);
      }
    },
  );
  it("includes the reproduced 8000 release in year-two cash flow of 485000", () => {
    const input = professionalFixture();
    const r = orchestrateProjectCalculation(
      {
        ...input,
        revenueProducts: input.revenueProducts.map((p) => ({
          ...p,
          annualQuantityGrowth: "-5",
          annualPriceEscalation: "0",
        })),
      },
      "2026-09-09",
    );
    equal(r.workingCapitalSummaries![0].workingCapitalGap, 190000);
    equal(r.workingCapitalSummaries![1].workingCapitalGap, 182000);
    equal(
      (
        r.investmentReturns!.series
          .periods[2] as ProjectInvestmentCashFlowPeriod
      ).components.workingCapitalRecovery!.value,
      8000,
    );
    equal(r.investmentReturns!.series.periods[2].cashFlow, 485000);
  });
});
