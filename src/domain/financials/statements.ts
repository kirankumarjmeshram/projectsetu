import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";

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
