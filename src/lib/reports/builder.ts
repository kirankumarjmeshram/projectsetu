import type { MetricResult } from "@/domain/metrics/metrics";

import type {
  BuildDprReportInput,
  DprReportModel,
  DprSection,
  NarrativeOverrides,
  ReportCell,
  ReportTable,
} from "./contracts";
import { DeterministicNarrativeProvider } from "./narrative/deterministic";
import type { NarrativeProvider } from "./narrative/provider";
import {
  financialCell,
  sanitizeReportFilename,
  textCell,
} from "./presentation";

const m = (value: string, path: string) => financialCell("MONEY", value, path);
const pct = (value: string, path: string) =>
  financialCell("PERCENT", value, path);
const metric = (value: MetricResult, path: string): ReportCell =>
  value.status === "DEFINED"
    ? financialCell("RATIO", value.value, path)
    : textCell(value.status.replaceAll("_", " "), "STATUS");
const metricPercentage = (value: MetricResult, path: string): ReportCell =>
  value.status === "DEFINED"
    ? pct(value.value, path)
    : textCell(value.status.replaceAll("_", " "), "STATUS");
const t = (
  id: string,
  title: string,
  columns: string[],
  rows: ReportCell[][],
  notes?: string[],
): ReportTable => ({ id, title, columns, rows, notes });

function narrativeOverride(
  id: string,
  generated: Awaited<ReturnType<NarrativeProvider["generate"]>>,
  overrides?: NarrativeOverrides,
) {
  const override = overrides?.[id];
  return override
    ? {
        text: override.text,
        approved: override.approved,
        provenance: "USER_APPROVED" as const,
      }
    : generated;
}

/** Builds presentation content by copying authoritative outputs; it invokes no engine. */
export async function buildDprReportModel(
  input: BuildDprReportInput,
  provider: NarrativeProvider = new DeterministicNarrativeProvider(),
): Promise<DprReportModel> {
  const { calculation: c, project: p } = input;
  const sections: DprSection[] = [];
  const facts = {
    projectName: p.project.name,
    projectMode: p.project.mode.replaceAll("_", " ").toLowerCase(),
    industryActivity: p.project.industryActivity,
    schemeSummary:
      p.selectedPrograms.length === 0
        ? "No government program is selected; this is a bankable no-scheme DPR."
        : `${p.selectedPrograms.length} versioned program selection(s) are presented from existing evaluation outputs.`,
    fundingSummary: c.fundingComposer
      ? `Funding composition status: ${c.fundingComposer.resolutionStatus.replaceAll("_", " ")}.`
      : "No scheme-composed funding applies.",
  } as const;
  let order = 1;
  const add = async (
    id: string,
    title: string,
    tables: ReportTable[] = [],
    userNarrative?: string,
  ) => {
    const allowedFinancialValues = tables.flatMap((table) =>
      table.rows.flatMap((row) =>
        row.flatMap((cell) =>
          cell.authoritativeValue ? [cell.authoritativeValue] : [],
        ),
      ),
    );
    const generated = userNarrative?.trim()
      ? {
          text: userNarrative.trim(),
          provenance: "USER_APPROVED" as const,
          approved: true,
        }
      : await provider.generate({
          sectionId: id,
          sectionTitle: title,
          facts,
          allowedFinancialValues,
        });
    sections.push({
      id,
      title,
      order: order++,
      tables,
      narrative: narrativeOverride(id, generated, input.narrativeOverrides),
    });
  };

  await add("cover", "Cover Page");
  await add("table-of-contents", "Table of Contents");
  await add("executive-summary", "Executive Summary", [
    t(
      "key-financials",
      "Key Financial Summary",
      ["Metric", "Value"],
      [
        ...(c.projectCost
          ? [
              [
                textCell("Total Project Cost"),
                m(
                  c.projectCost.totalProjectCost,
                  "projectCost.totalProjectCost",
                ),
              ],
            ]
          : []),
        ...(c.meansOfFinance
          ? [
              [
                textCell("Means of Finance"),
                m(
                  c.meansOfFinance.totalMeansOfFinance,
                  "meansOfFinance.totalMeansOfFinance",
                ),
              ],
            ]
          : []),
        ...(c.bankabilityMetrics
          ? [
              [
                textCell("Average DSCR"),
                metric(
                  c.bankabilityMetrics.averageDscr.averageDscr,
                  "bankabilityMetrics.averageDscr",
                ),
              ],
            ]
          : []),
        ...(c.investmentReturns
          ? [
              [
                textCell("NPV"),
                m(
                  c.investmentReturns.netPresentValue.npv,
                  "investmentReturns.npv",
                ),
              ],
            ]
          : []),
      ],
    ),
  ]);
  await add(
    "applicant-profile",
    "Applicant / Promoter Profile",
    [
      t(
        "applicant",
        "Applicant",
        ["Field", "Value"],
        [
          [textCell("Name"), textCell(p.applicant.name)],
          [
            textCell("Applicant Type"),
            textCell(p.applicant.applicantType.replaceAll("_", " ")),
          ],
          [
            textCell("Enterprise Status"),
            textCell(p.applicant.enterpriseStatus),
          ],
          ...(p.applicant.educationQualification
            ? [
                [
                  textCell("Qualification"),
                  textCell(p.applicant.educationQualification),
                ],
              ]
            : []),
          ...(p.applicant.experienceYears !== undefined
            ? [
                [
                  textCell("Relevant Experience"),
                  textCell(`${p.applicant.experienceYears} years`),
                ],
              ]
            : []),
        ],
      ),
    ],
    p.applicant.background,
  );
  await add(
    "project-profile",
    "Enterprise / Project Profile",
    [
      t(
        "project",
        "Project",
        ["Field", "Value"],
        [
          [textCell("Project"), textCell(p.project.name)],
          ...(p.project.enterpriseName
            ? [[textCell("Enterprise"), textCell(p.project.enterpriseName)]]
            : []),
          [textCell("Activity"), textCell(p.project.industryActivity)],
          [
            textCell("Location"),
            textCell(
              [p.project.address?.district, p.project.address?.state]
                .filter(Boolean)
                .join(", ") || "Not supplied",
            ),
          ],
          [
            textCell("Projection Period"),
            textCell(`${p.project.projectionPeriodYears} years`),
          ],
        ],
      ),
    ],
    p.project.projectDescription,
  );

  const optionalNarratives = [
    ["objectives", "Project Objectives", p.dprDetails?.businessObjective],
    [
      "industry-overview",
      "Industry / Business Overview",
      p.project.natureOfBusiness,
    ],
    [
      "product-description",
      "Product / Service Description",
      p.dprDetails?.productServiceDescription,
    ],
    [
      "market-sales",
      "Market & Sales Plan",
      [
        p.dprDetails?.targetMarket,
        p.dprDetails?.marketGeography,
        p.dprDetails?.competition,
        p.dprDetails?.marketingStrategy,
      ]
        .filter(Boolean)
        .join("\n\n"),
    ],
    [
      "process",
      "Manufacturing / Service Process",
      p.dprDetails?.operatingProcess,
    ],
    [
      "raw-materials",
      "Raw Materials / Inputs",
      p.dprDetails?.rawMaterialAvailability,
    ],
    [
      "infrastructure",
      "Infrastructure & Utilities",
      p.dprDetails?.infrastructureUtilities,
    ],
    ["manpower", "Manpower", p.dprDetails?.manpowerPlan],
    [
      "implementation",
      "Implementation Schedule",
      p.dprDetails?.implementationPlan,
    ],
  ] as const;
  for (const [id, title, narrative] of optionalNarratives) {
    if (narrative?.trim()) await add(id, title, [], narrative);
  }

  if (p.revenueProducts.length > 0) {
    await add("installed-capacity", "Installed Capacity & Utilisation", [
      t(
        "capacity-assumptions",
        "Year 1 Capacity Assumptions",
        ["Product / Service", "Unit", "Installed Capacity", "Utilisation"],
        p.revenueProducts.map((product, index) => [
          textCell(product.name || "Not provided"),
          textCell(product.unit || "Not provided"),
          financialCell(
            "INTEGER",
            product.quantityYear1,
            `input.revenueProducts.${index}.quantityYear1`,
          ),
          pct(
            product.capacityUtilisationYear1,
            `input.revenueProducts.${index}.capacityUtilisationYear1`,
          ),
        ]),
      ),
    ]);
  }

  if (c.projectCost)
    await add("project-cost", "Project Cost", [
      t(
        "project-cost",
        "Project Cost",
        ["Category", "Description", "Amount", "Source"],
        [
          ...c.projectCost.lines.map((line, i) => {
            const q = input.quotationReferences?.find(
              (ref) => ref.projectCostItemId === line.input.id,
            );
            return [
              textCell(line.input.category.replaceAll("_", " ")),
              textCell(line.input.description),
              m(line.finalAmount, `projectCost.lines.${i}.finalAmount`),
              textCell(
                q
                  ? `${q.supplierName ?? "Approved quotation"}${q.quotationNumber ? `, ${q.quotationNumber}` : ""}`
                  : "User assumption",
              ),
            ];
          }),
          [
            textCell("TOTAL"),
            textCell("Total Project Cost"),
            m(c.projectCost.totalProjectCost, "projectCost.totalProjectCost"),
            textCell(""),
          ],
        ],
      ),
    ]);
  if (c.meansOfFinance)
    await add("means-of-finance", "Means of Finance", [
      t(
        "means",
        "Means of Finance",
        ["Source", "Type", "Amount"],
        [
          ...c.meansOfFinance.sources.map((row, i) => [
            textCell(row.name),
            textCell(row.type.replaceAll("_", " ")),
            m(row.amount, `meansOfFinance.sources.${i}.amount`),
          ]),
          [
            textCell("Total"),
            textCell(""),
            m(
              c.meansOfFinance.totalMeansOfFinance,
              "meansOfFinance.totalMeansOfFinance",
            ),
          ],
        ],
        [
          "Initial funding is separated from future, back-ended, conditional and non-cash assistance.",
        ],
      ),
    ]);
  if (c.workingCapitalSummaries)
    await add("working-capital", "Working Capital", [
      t(
        "working-capital",
        "Working Capital",
        [
          "Year",
          "Current Assets",
          "Current Liabilities",
          "Gap",
          "Bank Finance",
        ],
        c.workingCapitalSummaries.map((row, i) => [
          textCell(`Year ${row.projectionYear}`),
          m(row.totalCurrentAssets, `workingCapital.${i}.totalCurrentAssets`),
          m(
            row.totalCurrentLiabilities,
            `workingCapital.${i}.totalCurrentLiabilities`,
          ),
          m(row.workingCapitalGap, `workingCapital.${i}.gap`),
          row.bankFinanceRequired
            ? m(row.bankFinanceRequired, `workingCapital.${i}.bankFinance`)
            : textCell("Not applicable"),
        ]),
      ),
    ]);
  await add("loan-assumptions", "Loan Assumptions");
  if (c.loanSchedule)
    await add("repayment-schedule", "Repayment Schedule", [
      t(
        "loan",
        "Annual Loan Repayment",
        ["Year", "Opening", "Principal", "Interest", "Debt Service", "Closing"],
        c.loanSchedule.annualSummaries.map((row, i) => [
          textCell(`Year ${row.projectionYear}`),
          m(row.openingPrincipal, `loan.${i}.openingPrincipal`),
          m(row.principalRepaid, `loan.${i}.principalRepaid`),
          m(row.interestCharged, `loan.${i}.interestCharged`),
          m(row.totalDebtService, `loan.${i}.totalDebtService`),
          m(row.closingPrincipal, `loan.${i}.closingPrincipal`),
        ]),
      ),
    ]);
  if (c.projection) {
    await add("revenue-projections", "Revenue Projections", [
      t(
        "revenue",
        "Revenue",
        [
          "Year",
          "Product / Service",
          "Quantity",
          "Capacity %",
          "Unit Price",
          "Revenue",
        ],
        c.projection.years.flatMap((year, yi) =>
          year.revenueLines.map((row, li) => [
            textCell(`Year ${year.year}`),
            textCell(row.input.productOrServiceName),
            financialCell(
              "RATIO",
              row.quantity,
              `projection.${yi}.revenue.${li}.quantity`,
            ),
            pct(
              row.capacityUtilisation,
              `projection.${yi}.revenue.${li}.capacity`,
            ),
            m(row.unitPrice, `projection.${yi}.revenue.${li}.price`),
            m(row.revenue, `projection.${yi}.revenue.${li}.revenue`),
          ]),
        ),
      ),
    ]);
    await add("operating-expenses", "Operating Expense Projections", [
      t(
        "opex",
        "Operating Expenses",
        [
          "Year",
          "Variable",
          "Wages",
          "Salaries",
          "Utilities",
          "Repairs",
          "Other",
          "Total",
        ],
        c.projection.years.map((row, i) => [
          textCell(`Year ${row.year}`),
          m(row.rawMaterialAndVariableCosts, `projection.${i}.variable`),
          m(row.wages, `projection.${i}.wages`),
          m(row.salaries, `projection.${i}.salaries`),
          m(row.utilities, `projection.${i}.utilities`),
          m(row.repairsAndMaintenance, `projection.${i}.repairs`),
          m(row.administrativeAndOtherOperatingCosts, `projection.${i}.other`),
          m(
            row.totalOperatingExpenses,
            `projection.${i}.totalOperatingExpenses`,
          ),
        ]),
      ),
    ]);
  }
  if (c.depreciation)
    await add("depreciation", "Depreciation", [
      t(
        "depreciation",
        "Depreciation",
        [
          "Year",
          "Opening Gross",
          "Additions",
          "Depreciation",
          "Accumulated",
          "Closing Gross",
          "Closing Net",
        ],
        c.depreciation.yearlySummaries.map((row, i) => [
          textCell(`Year ${row.year}`),
          m(row.openingGrossFixedAssets, `depreciation.${i}.openingGross`),
          m(row.additions, `depreciation.${i}.additions`),
          m(row.depreciation, `depreciation.${i}.expense`),
          m(row.accumulatedDepreciation, `depreciation.${i}.accumulated`),
          m(row.closingGrossFixedAssets, `depreciation.${i}.closingGross`),
          m(row.closingNetCarryingValue, `depreciation.${i}.closingNet`),
        ]),
      ),
    ]);
  if (c.profitAndLoss)
    await add("profit-loss", "Projected Profit & Loss", [
      t(
        "profit-loss",
        "Projected Profit & Loss",
        [
          "Year",
          "Revenue",
          "Opex",
          "EBITDA",
          "Depreciation",
          "EBIT",
          "Interest",
          "PBT",
          "Tax",
          "PAT",
        ],
        c.profitAndLoss.years.map((row, i) => [
          textCell(`Year ${row.year}`),
          m(row.revenue, `profitAndLoss.${i}.revenue`),
          m(row.operatingExpenses, `profitAndLoss.${i}.operatingExpenses`),
          m(row.ebitda, `profitAndLoss.${i}.ebitda`),
          m(row.depreciation, `profitAndLoss.${i}.depreciation`),
          m(row.ebit, `profitAndLoss.${i}.ebit`),
          m(row.interestExpense, `profitAndLoss.${i}.interestExpense`),
          m(row.profitBeforeTax, `profitAndLoss.${i}.pbt`),
          m(row.taxExpense, `profitAndLoss.${i}.tax`),
          m(row.profitAfterTax, `profitAndLoss.${i}.pat`),
        ]),
      ),
    ]);
  if (c.cashFlow)
    await add("cash-flow", "Cash Flow", [
      t(
        "cash-flow",
        "Projected Cash Flow",
        [
          "Year",
          "Opening Cash",
          "Operating",
          "Investing",
          "Financing",
          "Net Movement",
          "Closing Cash",
        ],
        c.cashFlow.years.map((row, i) => [
          textCell(`Year ${row.year}`),
          m(row.openingCash, `cashFlow.${i}.openingCash`),
          m(row.operatingCashFlow, `cashFlow.${i}.operating`),
          m(row.investingCashFlow, `cashFlow.${i}.investing`),
          m(row.financingCashFlow, `cashFlow.${i}.financing`),
          m(row.netCashMovement, `cashFlow.${i}.netMovement`),
          m(row.closingCash, `cashFlow.${i}.closingCash`),
        ]),
        [
          "Operating cash flow adds back depreciation and P&L interest; actual interest paid is included once under financing. Startup asset acquisitions are included in year-one investing cash flow.",
        ],
      ),
    ]);
  if (c.balanceSheet)
    await add("balance-sheet", "Balance Sheet", [
      t(
        "balance-sheet",
        "Projected Balance Sheet",
        [
          "Year",
          "Net Fixed Assets",
          "Current Assets",
          "Total Assets",
          "Liabilities",
          "Equity",
          "Difference",
          "Status",
        ],
        c.balanceSheet.years.map((row, i) => [
          textCell(`Year ${row.year}`),
          m(row.netFixedAssets, `balanceSheet.${i}.netFixedAssets`),
          m(row.totalCurrentAssets, `balanceSheet.${i}.currentAssets`),
          m(row.totalAssets, `balanceSheet.${i}.totalAssets`),
          m(row.totalLiabilities, `balanceSheet.${i}.liabilities`),
          m(row.totalEquity, `balanceSheet.${i}.equity`),
          m(row.balanceDifference, `balanceSheet.${i}.difference`),
          textCell(row.isBalanced ? "BALANCED" : "UNBALANCED", "STATUS"),
        ]),
      ),
    ]);
  if (c.bankabilityMetrics) {
    const rows = c.bankabilityMetrics.years.map((row, i) => [
      textCell(`Year ${row.year}`),
      metric(row.dscr, `metrics.${i}.dscr`),
      metric(row.interestCoverageRatio, `metrics.${i}.interestCoverage`),
      metric(row.debtEquityRatio, `metrics.${i}.debtEquity`),
      metric(row.currentRatio, `metrics.${i}.currentRatio`),
      metricPercentage(row.breakEvenPercentage, `metrics.${i}.breakEven`),
      metricPercentage(row.roi, `metrics.${i}.roi`),
      metricPercentage(row.roce, `metrics.${i}.roce`),
    ]);
    await add("dscr", "DSCR", [
      t(
        "ratios",
        "Ratios and DSCR",
        [
          "Year",
          "DSCR",
          "Interest Coverage",
          "Debt Equity",
          "Current Ratio",
          "Break-even %",
          "ROI",
          "ROCE",
        ],
        rows,
      ),
    ]);
    await add("break-even", "Break-Even Analysis");
    await add("financial-ratios", "Financial Ratios");
  }
  if (c.investmentReturns) {
    const irr = c.investmentReturns.internalRateOfReturn.irr;
    const payback = c.investmentReturns.simplePayback.paybackPeriod;
    const pi = c.investmentReturns.profitabilityIndex.profitabilityIndex;
    await add("investment-returns", "Investment Returns", [
      t(
        "returns",
        "Indicative Pre-tax Project Returns",
        ["Metric", "Status", "Value"],
        [
          [
            textCell("NPV"),
            textCell("DEFINED"),
            m(c.investmentReturns.netPresentValue.npv, "investmentReturns.npv"),
          ],
          [
            textCell("IRR"),
            textCell(irr.status),
            irr.status === "DEFINED"
              ? pct(irr.value, "investmentReturns.irr")
              : textCell("Not defined"),
          ],
          [
            textCell("Simple Payback"),
            textCell(payback.status),
            payback.status === "DEFINED"
              ? financialCell(
                  "RATIO",
                  payback.value,
                  "investmentReturns.payback",
                )
              : textCell("Not defined"),
          ],
          [
            textCell("Profitability Index"),
            textCell(pi.status),
            pi.status === "DEFINED"
              ? financialCell("RATIO", pi.value, "investmentReturns.pi")
              : textCell("Not defined"),
          ],
        ],
        [
          "Pre-tax, unlevered project cash flows: EBITDA less operating working-capital investment; initial working-capital reserve is not counted twice. Terminal working capital is assumed recovered; no asset salvage is assumed. These are indicative assumptions, not equity returns or lender approval.",
        ],
      ),
    ]);
  }
  if (p.selectedPrograms.length > 0) {
    const evaluations = c.fundingComposer?.individualProgramEvaluations ?? [];
    await add("scheme-assistance", "Scheme Assistance", [
      t(
        "programs",
        "Selected Versioned Programs",
        [
          "Program",
          "Version",
          "Evaluation Date",
          "Eligibility",
          "Program Type",
        ],
        p.selectedPrograms.map((selection) => {
          const evaluation = evaluations.find(
            (candidate) =>
              candidate.selection.programId === selection.programId,
          );
          return [
            textCell(selection.programId),
            textCell(
              evaluation?.snapshot?.programVersionId ??
                selection.versionId ??
                "Not resolved",
            ),
            textCell(
              evaluation?.snapshot?.evaluationAsOfDate ??
                c.fundingComposer?.evaluationAsOfDate ??
                "Not available",
            ),
            textCell(
              evaluation?.evaluation?.eligibility.status ??
                evaluation?.status ??
                "Not evaluated",
              "STATUS",
            ),
            textCell(
              evaluation?.evaluation?.programTypes.join(", ") ??
                "Not available",
            ),
          ];
        }),
      ),
      t(
        "program-benefits",
        "Calculated Program Benefits",
        [
          "Program",
          "Benefit",
          "Kind",
          "Status",
          "Amount",
          "Release / Conditions",
        ],
        evaluations.flatMap((evaluation) =>
          (evaluation.evaluation?.benefits ?? []).map((benefit, i) => [
            textCell(
              evaluation.snapshot?.programId ?? evaluation.selection.programId,
            ),
            textCell(benefit.benefitId),
            textCell(benefit.benefitKind),
            textCell(benefit.status, "STATUS"),
            benefit.calculatedEligibleBenefit
              ? m(
                  benefit.calculatedEligibleBenefit,
                  `funding.evaluations.${i}.benefit`,
                )
              : textCell("Not calculated"),
            textCell(
              [
                benefit.release.mechanism,
                ...(benefit.release.conditions ?? []),
              ].join("; "),
            ),
          ]),
        ),
        [
          "Credit benefits, including MUDRA, are presented as credit—not subsidy. Back-ended margin money, including PMEGP, is not presented as immediate guaranteed cash.",
        ],
      ),
    ]);
  }
  if (c.fundingComposer)
    await add("funding-composition", "Funding Composition", [
      t(
        "funding",
        "Funding Composition",
        ["Field", "Value"],
        [
          [
            textCell("Resolution Status"),
            textCell(c.fundingComposer.resolutionStatus, "STATUS"),
          ],
          [
            textCell("Initial Funding Sources"),
            c.fundingComposer.summary.totalInitialFundingSources
              ? m(
                  c.fundingComposer.summary.totalInitialFundingSources,
                  "funding.summary.initialFunding",
                )
              : textCell("Not resolved"),
          ],
          [
            textCell("Deferred Conditional Assistance"),
            m(
              c.fundingComposer.summary.benefits
                .totalDeferredConditionalAssistance,
              "funding.summary.deferred",
            ),
          ],
          [
            textCell("Credit Guarantee (non-cash)"),
            m(
              c.fundingComposer.summary.benefits.creditGuarantee,
              "funding.summary.creditGuarantee",
            ),
          ],
        ],
        [
          c.fundingComposer.resolutionStatus === "MANUAL_REVIEW_REQUIRED"
            ? "Compatibility could not be established from the registered authoritative program rules and requires manual review."
            : "Compatibility is presented exactly as resolved by the funding snapshot.",
        ],
      ),
    ]);
  await add(
    "risks-mitigation",
    "Risks & Mitigation",
    [],
    [p.dprDetails?.strengths, p.dprDetails?.risks, p.dprDetails?.riskMitigation]
      .filter(Boolean)
      .join("\n\n") || undefined,
  );
  await add("conclusion", "Conclusion / Bankability Summary");
  await add("assumptions-notes", "Assumptions & Notes", [
    t(
      "assumptions",
      "Core Assumptions",
      ["Assumption", "Value"],
      [
        [
          textCell("Projection period"),
          textCell(`${p.project.projectionPeriodYears} years`),
        ],
        [textCell("Tax mode"), textCell(p.taxAndReturns.taxMode)],
        [textCell("Tax rate"), pct(p.taxAndReturns.taxRate, "input.taxRate")],
        [
          textCell("Discount rate"),
          pct(p.taxAndReturns.discountRate, "input.discountRate"),
        ],
      ],
    ),
  ]);
  await add("sources", "Source / Provenance Summary");
  if ((input.quotationReferences?.length ?? 0) > 0)
    await add("annexures", "Annexures", [
      t(
        "annexures",
        "Approved Annexure Index",
        ["Document", "Version", "Reference"],
        (input.quotationReferences ?? []).map((q) => [
          textCell(q.supplierName ?? "Approved quotation"),
          textCell(q.documentVersion),
          textCell(q.documentId),
        ]),
        [
          "Sensitive identity documents are not automatically annexed; inclusion is explicit.",
        ],
      ),
    ]);

  return {
    identity: input.identity,
    title: `Detailed Project Report — ${p.project.name}`,
    filenameStem: sanitizeReportFilename(
      p.project.name,
      input.identity.reportVersion,
    ),
    project: p,
    calculation: c,
    sections,
    sources: [
      {
        kind: "USER_ASSUMPTION",
        label: "Immutable project input snapshot",
        referenceId: input.identity.inputSnapshotId,
      },
      {
        kind: "CALCULATION_SNAPSHOT",
        label: "Authoritative financial calculation",
        referenceId: input.identity.calculationRunId,
      },
      ...(input.identity.fundingSnapshotId
        ? [
            {
              kind: "FUNDING_SNAPSHOT" as const,
              label: "Versioned funding composition",
              referenceId: input.identity.fundingSnapshotId,
            },
          ]
        : []),
      ...(input.quotationReferences ?? []).map((q) => ({
        kind: "APPROVED_QUOTATION" as const,
        label: q.supplierName ?? "Approved quotation",
        referenceId: q.documentId,
        details: q.quotationNumber,
      })),
    ],
    quotationReferences: input.quotationReferences ?? [],
    disclaimer: [
      "Financial projections are based on supplied assumptions and the referenced ProjectSetu calculation snapshot.",
      "Calculated program benefits are subject to eligibility, verification, sanction, release conditions and the competent authority's decision.",
      "This report does not constitute bank approval, government sanction or a guarantee of financial performance.",
      "The applicant should independently verify applicable statutory registrations, licences, permissions and lender requirements.",
    ],
  };
}
