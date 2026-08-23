import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";

export interface ProjectedProfitAndLossYear {
  readonly year: ProjectionYear;
  readonly sales: MonetaryAmount;
  readonly otherIncome: MonetaryAmount;
  readonly rawMaterials: MonetaryAmount;
  readonly directExpenses: MonetaryAmount;
  readonly grossProfit: MonetaryAmount;
  readonly salary: MonetaryAmount;
  readonly administrativeExpenses: MonetaryAmount;
  readonly sellingExpenses: MonetaryAmount;
  readonly ebitda: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly ebit: MonetaryAmount;
  readonly interest: MonetaryAmount;
  readonly profitBeforeTax: MonetaryAmount;
  readonly tax: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
}

export interface ProjectedProfitAndLoss {
  readonly projectId: Identifier;
  readonly years: readonly ProjectedProfitAndLossYear[];
}

export interface ProjectedCashFlowYear {
  readonly year: ProjectionYear;
  readonly openingCash: MonetaryAmount;
  readonly cashInflows: MonetaryAmount;
  readonly cashOutflows: MonetaryAmount;
  readonly netCashFlow: MonetaryAmount;
  readonly closingCash: MonetaryAmount;
}

export interface ProjectedCashFlow {
  readonly projectId: Identifier;
  readonly years: readonly ProjectedCashFlowYear[];
}

export interface ProjectedBalanceSheetYear {
  readonly year: ProjectionYear;
  readonly capital: MonetaryAmount;
  readonly reserves: MonetaryAmount;
  readonly termLoan: MonetaryAmount;
  readonly workingCapitalBorrowing: MonetaryAmount;
  readonly creditors: MonetaryAmount;
  readonly otherLiabilities: MonetaryAmount;
  readonly grossFixedAssets: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  readonly netFixedAssets: MonetaryAmount;
  readonly inventory: MonetaryAmount;
  readonly receivables: MonetaryAmount;
  readonly cashAndBank: MonetaryAmount;
  readonly otherCurrentAssets: MonetaryAmount;
}

export interface ProjectedBalanceSheet {
  readonly projectId: Identifier;
  readonly years: readonly ProjectedBalanceSheetYear[];
}
