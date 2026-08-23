import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";

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
