import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import type { DecimalInstance } from "../shared/decimal";
import type {
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";
import type {
  AggregateDepreciationYear,
  AssetDepreciationSchedule,
  AssetDepreciationYear,
  DepreciableAsset,
  DepreciationAssetAddition,
  DepreciationProjectionInput,
  DepreciationSchedule,
  StraightLineDepreciableAsset,
  WrittenDownValueDepreciableAsset,
} from "./depreciation";

const zeroAmount = monetaryAmount("0");
const percentageUpperBound = decimalValue("100");

function toProjectionYear(year: number): ProjectionYear {
  return year;
}

function validateProjectionPeriod(
  projectionPeriodYears: number,
): CalculationError | undefined {
  if (!Number.isInteger(projectionPeriodYears) || projectionPeriodYears <= 0) {
    return {
      code: "INVALID_DEPRECIATION_PROJECTION_PERIOD",
      message: "Depreciation projection years must be a positive integer.",
      path: "projectionPeriodYears",
    };
  }
}

function validateNonNegativeAmount(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (toDecimal(value).isNegative()) {
    return {
      code,
      message: label + " must not be negative.",
      path,
    };
  }
}

function validateResidualAgainstCost(
  cost: MonetaryAmount,
  residualValue: MonetaryAmount,
  path: string,
): CalculationError | undefined {
  if (toDecimal(residualValue).greaterThan(toDecimal(cost))) {
    return {
      code: "RESIDUAL_VALUE_EXCEEDS_COST",
      message: "Residual value must not exceed its related asset cost.",
      path,
    };
  }
}

function validateRate(
  rate: Percentage,
  path: string,
): CalculationError | undefined {
  const rateValue = toDecimal(rate);

  if (rateValue.isNegative() || rateValue.greaterThan(percentageUpperBound)) {
    return {
      code: "INVALID_DEPRECIATION_RATE",
      message: "Depreciation rate must be between 0 and 100 percent points.",
      path,
    };
  }
}

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) {
    errors.push(error);
  }
}

function validateAddition(
  addition: DepreciationAssetAddition,
  projectionPeriodYears: number,
  depreciationStartYear: ProjectionYear,
  path: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];

  if (
    !Number.isInteger(addition.year) ||
    addition.year <= 0 ||
    addition.year > projectionPeriodYears
  ) {
    errors.push({
      code: "ADDITION_OUTSIDE_PROJECTION_PERIOD",
      message:
        "Asset addition year must be a positive integer within the projection period.",
      path: path + ".year",
    });
  } else if (addition.year < depreciationStartYear) {
    errors.push({
      code: "ADDITION_BEFORE_DEPRECIATION_START",
      message:
        "Asset addition must not precede the asset depreciation start year.",
      path: path + ".year",
    });
  }

  pushError(
    errors,
    validateNonNegativeAmount(
      addition.cost.value,
      path + ".cost.value",
      "NEGATIVE_ASSET_ADDITION",
      "Asset addition cost",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      addition.residualValue.value,
      path + ".residualValue.value",
      "NEGATIVE_ADDITION_RESIDUAL_VALUE",
      "Asset addition residual value",
    ),
  );
  pushError(
    errors,
    validateResidualAgainstCost(
      addition.cost.value,
      addition.residualValue.value,
      path + ".residualValue.value",
    ),
  );

  return errors;
}

type RuntimeDepreciableAsset = DepreciableAsset & {
  readonly usefulLifeYears?: StraightLineDepreciableAsset["usefulLifeYears"];
  readonly depreciationRate?: WrittenDownValueDepreciableAsset["depreciationRate"];
};

function validateAsset(
  asset: DepreciableAsset,
  projectionPeriodYears: number,
  path: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const runtimeAsset = asset as RuntimeDepreciableAsset;

  pushError(
    errors,
    validateNonNegativeAmount(
      asset.originalCost.value,
      path + ".originalCost.value",
      "NEGATIVE_ASSET_COST",
      "Original asset cost",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      asset.residualValue.value,
      path + ".residualValue.value",
      "NEGATIVE_RESIDUAL_VALUE",
      "Asset residual value",
    ),
  );
  pushError(
    errors,
    validateResidualAgainstCost(
      asset.originalCost.value,
      asset.residualValue.value,
      path + ".residualValue.value",
    ),
  );

  if (
    !Number.isInteger(asset.depreciationStartYear) ||
    asset.depreciationStartYear <= 0 ||
    asset.depreciationStartYear > projectionPeriodYears
  ) {
    errors.push({
      code: "INVALID_DEPRECIATION_START_YEAR",
      message:
        "Depreciation start year must be a positive integer within the projection period.",
      path: path + ".depreciationStartYear",
    });
  }

  const additionIds = new Set<string>();

  for (const [index, addition] of (asset.additions ?? []).entries()) {
    if (additionIds.has(addition.id)) {
      errors.push({
        code: "DUPLICATE_ASSET_ADDITION_ID",
        message: "Asset addition ids must be unique within an asset.",
        path: path + ".additions." + index + ".id",
      });
    } else {
      additionIds.add(addition.id);
    }

    errors.push(
      ...validateAddition(
        addition,
        projectionPeriodYears,
        asset.depreciationStartYear,
        path + ".additions." + index,
      ),
    );
  }

  if (asset.method === "STRAIGHT_LINE") {
    if (!runtimeAsset.usefulLifeYears) {
      errors.push({
        code: "MISSING_USEFUL_LIFE",
        message: "Straight-line depreciation requires a useful life.",
        path: path + ".usefulLifeYears",
      });
    } else if (
      !Number.isInteger(runtimeAsset.usefulLifeYears.value) ||
      runtimeAsset.usefulLifeYears.value <= 0
    ) {
      errors.push({
        code: "INVALID_USEFUL_LIFE",
        message: "Straight-line useful life must be a positive integer.",
        path: path + ".usefulLifeYears.value",
      });
    }

    if (runtimeAsset.depreciationRate !== undefined) {
      errors.push({
        code: "INCOMPATIBLE_DEPRECIATION_CONFIGURATION",
        message: "Straight-line depreciation must not supply a WDV rate.",
        path: path + ".depreciationRate",
      });
    }

    return errors;
  }

  if (asset.method === "WRITTEN_DOWN_VALUE") {
    if (!runtimeAsset.depreciationRate) {
      errors.push({
        code: "MISSING_DEPRECIATION_RATE",
        message: "Written-down-value depreciation requires a rate.",
        path: path + ".depreciationRate",
      });
    } else {
      pushError(
        errors,
        validateRate(
          runtimeAsset.depreciationRate.value,
          path + ".depreciationRate.value",
        ),
      );
    }

    if (runtimeAsset.usefulLifeYears !== undefined) {
      errors.push({
        code: "INCOMPATIBLE_DEPRECIATION_CONFIGURATION",
        message:
          "Written-down-value depreciation must not supply a useful life.",
        path: path + ".usefulLifeYears",
      });
    }

    return errors;
  }

  errors.push({
    code: "UNSUPPORTED_DEPRECIATION_METHOD",
    message: "The depreciation method is not supported.",
    path: path + ".method",
  });

  return errors;
}

export function calculateStraightLineAnnualDepreciation(
  cost: MonetaryAmount,
  residualValue: MonetaryAmount,
  usefulLifeYears: number,
): CalculationResult<MonetaryAmount> {
  const errors: CalculationError[] = [];

  pushError(
    errors,
    validateNonNegativeAmount(
      cost,
      "cost",
      "NEGATIVE_ASSET_COST",
      "Asset cost",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      residualValue,
      "residualValue",
      "NEGATIVE_RESIDUAL_VALUE",
      "Residual value",
    ),
  );
  pushError(
    errors,
    validateResidualAgainstCost(cost, residualValue, "residualValue"),
  );

  if (!Number.isInteger(usefulLifeYears) || usefulLifeYears <= 0) {
    errors.push({
      code: "INVALID_USEFUL_LIFE",
      message: "Straight-line useful life must be a positive integer.",
      path: "usefulLifeYears",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(
    toMonetaryAmount(
      toDecimal(cost)
        .minus(toDecimal(residualValue))
        .dividedBy(decimalValue(String(usefulLifeYears))),
    ),
  );
}

export function calculateWrittenDownValueDepreciation(
  openingCarryingValue: MonetaryAmount,
  additions: MonetaryAmount,
  residualValue: MonetaryAmount,
  depreciationRate: Percentage,
): CalculationResult<MonetaryAmount> {
  const errors: CalculationError[] = [];

  pushError(
    errors,
    validateNonNegativeAmount(
      openingCarryingValue,
      "openingCarryingValue",
      "NEGATIVE_OPENING_CARRYING_VALUE",
      "Opening carrying value",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      additions,
      "additions",
      "NEGATIVE_ASSET_ADDITION",
      "Asset additions",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      residualValue,
      "residualValue",
      "NEGATIVE_RESIDUAL_VALUE",
      "Residual value",
    ),
  );
  pushError(errors, validateRate(depreciationRate, "depreciationRate"));

  const depreciationBase = toDecimal(openingCarryingValue).plus(
    toDecimal(additions),
  );

  if (toDecimal(residualValue).greaterThan(depreciationBase)) {
    errors.push({
      code: "RESIDUAL_VALUE_EXCEEDS_DEPRECIATION_BASE",
      message: "Residual value must not exceed the depreciation base.",
      path: "residualValue",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(
    calculateWrittenDownValueDepreciationUnchecked(
      openingCarryingValue,
      additions,
      residualValue,
      depreciationRate,
    ),
  );
}

function calculateWrittenDownValueDepreciationUnchecked(
  openingCarryingValue: MonetaryAmount,
  additions: MonetaryAmount,
  residualValue: MonetaryAmount,
  depreciationRate: Percentage,
): MonetaryAmount {
  const depreciationBase = toDecimal(openingCarryingValue).plus(
    toDecimal(additions),
  );
  const calculatedDepreciation = depreciationBase.times(
    percentageToFactor(depreciationRate),
  );
  const maximumDepreciation = depreciationBase.minus(toDecimal(residualValue));

  return toMonetaryAmount(
    calculatedDepreciation.greaterThan(maximumDepreciation)
      ? maximumDepreciation
      : calculatedDepreciation,
  );
}

interface StraightLineComponentState {
  readonly cost: MonetaryAmount;
  readonly residualValue: MonetaryAmount;
  readonly startYear: ProjectionYear;
  accumulatedDepreciation: DecimalInstance;
  elapsedYears: number;
}

interface ComponentDepreciation {
  readonly component: StraightLineComponentState;
  amount: DecimalInstance;
}

function additionTotal(
  additions: readonly DepreciationAssetAddition[],
): MonetaryAmount {
  let total = toDecimal(zeroAmount);

  for (const addition of additions) {
    total = total.plus(toDecimal(addition.cost.value));
  }

  return toMonetaryAmount(total);
}

function calculateStraightLineComponentDepreciation(
  components: readonly StraightLineComponentState[],
  usefulLifeYears: number,
  year: ProjectionYear,
  maximumDepreciation: DecimalInstance,
): DecimalInstance {
  const componentDepreciations: ComponentDepreciation[] = [];
  let totalDepreciation = toDecimal(zeroAmount);

  for (const component of components) {
    if (
      component.startYear > year ||
      component.elapsedYears >= usefulLifeYears
    ) {
      continue;
    }

    const depreciableAmount = toDecimal(component.cost).minus(
      toDecimal(component.residualValue),
    );
    const annualDepreciation = depreciableAmount.dividedBy(
      decimalValue(String(usefulLifeYears)),
    );
    const remainingDepreciableAmount = depreciableAmount.minus(
      component.accumulatedDepreciation,
    );
    const isFinalUsefulLifeYear =
      component.elapsedYears === usefulLifeYears - 1;
    const componentDepreciation =
      isFinalUsefulLifeYear ||
      annualDepreciation.greaterThan(remainingDepreciableAmount)
        ? remainingDepreciableAmount
        : annualDepreciation;

    componentDepreciations.push({
      component,
      amount: componentDepreciation,
    });
    totalDepreciation = totalDepreciation.plus(componentDepreciation);
  }

  if (totalDepreciation.greaterThan(maximumDepreciation)) {
    const excess = totalDepreciation.minus(maximumDepreciation);
    const finalComponent = componentDepreciations.at(-1);

    if (finalComponent) {
      finalComponent.amount = finalComponent.amount.minus(excess);
    }
    totalDepreciation = maximumDepreciation;
  }

  for (const { component, amount } of componentDepreciations) {
    component.accumulatedDepreciation =
      component.accumulatedDepreciation.plus(amount);
    component.elapsedYears += 1;
  }

  return totalDepreciation;
}

function calculateAssetScheduleUnchecked(
  asset: DepreciableAsset,
  projectionPeriodYears: number,
): AssetDepreciationSchedule {
  const years: AssetDepreciationYear[] = [];
  let openingGrossValue = asset.originalCost.value;
  let openingCarryingValue = asset.originalCost.value;
  let residualFloor = asset.residualValue.value;
  const straightLineComponents: StraightLineComponentState[] = [
    {
      cost: asset.originalCost.value,
      residualValue: asset.residualValue.value,
      startYear: asset.depreciationStartYear,
      accumulatedDepreciation: toDecimal(zeroAmount),
      elapsedYears: 0,
    },
  ];

  for (
    let year = asset.depreciationStartYear;
    year <= projectionPeriodYears;
    year += 1
  ) {
    const projectionYear = toProjectionYear(year);
    const currentAdditions = (asset.additions ?? []).filter(
      (addition) => addition.year === projectionYear,
    );
    const additions = additionTotal(currentAdditions);

    for (const addition of currentAdditions) {
      residualFloor = toMonetaryAmount(
        toDecimal(residualFloor).plus(toDecimal(addition.residualValue.value)),
      );
      straightLineComponents.push({
        cost: addition.cost.value,
        residualValue: addition.residualValue.value,
        startYear: addition.year,
        accumulatedDepreciation: toDecimal(zeroAmount),
        elapsedYears: 0,
      });
    }

    const depreciationBase = toMonetaryAmount(
      toDecimal(openingCarryingValue).plus(toDecimal(additions)),
    );
    const maximumDepreciation = toDecimal(depreciationBase).minus(
      toDecimal(residualFloor),
    );
    let depreciation: MonetaryAmount;

    if (asset.method === "STRAIGHT_LINE") {
      depreciation = toMonetaryAmount(
        calculateStraightLineComponentDepreciation(
          straightLineComponents,
          asset.usefulLifeYears.value,
          projectionYear,
          maximumDepreciation,
        ),
      );
    } else {
      depreciation = calculateWrittenDownValueDepreciationUnchecked(
        openingCarryingValue,
        additions,
        residualFloor,
        asset.depreciationRate.value,
      );
    }

    const closingGrossValue = toMonetaryAmount(
      toDecimal(openingGrossValue).plus(toDecimal(additions)),
    );
    const closingCarryingValue = toMonetaryAmount(
      toDecimal(depreciationBase).minus(toDecimal(depreciation)),
    );
    const accumulatedDepreciation = toMonetaryAmount(
      toDecimal(closingGrossValue).minus(toDecimal(closingCarryingValue)),
    );

    years.push({
      year: projectionYear,
      assetId: asset.id,
      assetName: asset.name,
      assetCategory: asset.category,
      method: asset.method,
      openingGrossValue,
      additions,
      closingGrossValue,
      openingCarryingValue,
      depreciationBase,
      depreciation,
      accumulatedDepreciation,
      closingCarryingValue,
      residualValue: residualFloor,
    });

    openingGrossValue = closingGrossValue;
    openingCarryingValue = closingCarryingValue;
  }

  return { asset, years };
}

export function calculateAssetDepreciationSchedule(
  asset: DepreciableAsset,
  projectionPeriodYears: number,
): CalculationResult<AssetDepreciationSchedule> {
  const projectionError = validateProjectionPeriod(projectionPeriodYears);

  if (projectionError) {
    return calculationFailure(projectionError);
  }

  const errors = validateAsset(asset, projectionPeriodYears, "asset");

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(
    calculateAssetScheduleUnchecked(asset, projectionPeriodYears),
  );
}

export function summarizeDepreciationByYear(
  assetSchedules: readonly AssetDepreciationSchedule[],
  projectionPeriodYears: number,
): readonly AggregateDepreciationYear[] {
  const summaries: AggregateDepreciationYear[] = [];

  for (let year = 1; year <= projectionPeriodYears; year += 1) {
    const projectionYear = toProjectionYear(year);
    let openingGrossFixedAssets = toDecimal(zeroAmount);
    let additions = toDecimal(zeroAmount);
    let depreciation = toDecimal(zeroAmount);
    let accumulatedDepreciation = toDecimal(zeroAmount);
    let closingGrossFixedAssets = toDecimal(zeroAmount);
    let closingNetCarryingValue = toDecimal(zeroAmount);

    for (const schedule of assetSchedules) {
      const row = schedule.years.find(
        (assetYear) => assetYear.year === projectionYear,
      );

      if (!row) {
        continue;
      }

      openingGrossFixedAssets = openingGrossFixedAssets.plus(
        toDecimal(row.openingGrossValue),
      );
      additions = additions.plus(toDecimal(row.additions));
      depreciation = depreciation.plus(toDecimal(row.depreciation));
      accumulatedDepreciation = accumulatedDepreciation.plus(
        toDecimal(row.accumulatedDepreciation),
      );
      closingGrossFixedAssets = closingGrossFixedAssets.plus(
        toDecimal(row.closingGrossValue),
      );
      closingNetCarryingValue = closingNetCarryingValue.plus(
        toDecimal(row.closingCarryingValue),
      );
    }

    summaries.push({
      year: projectionYear,
      openingGrossFixedAssets: toMonetaryAmount(openingGrossFixedAssets),
      additions: toMonetaryAmount(additions),
      depreciation: toMonetaryAmount(depreciation),
      accumulatedDepreciation: toMonetaryAmount(accumulatedDepreciation),
      closingGrossFixedAssets: toMonetaryAmount(closingGrossFixedAssets),
      closingNetCarryingValue: toMonetaryAmount(closingNetCarryingValue),
    });
  }

  return summaries;
}

export function calculateDepreciationSchedule(
  input: DepreciationProjectionInput,
): CalculationResult<DepreciationSchedule> {
  const projectionError = validateProjectionPeriod(input.projectionPeriodYears);

  if (projectionError) {
    return calculationFailure(projectionError);
  }

  const errors: CalculationError[] = [];

  for (const [index, asset] of input.assets.entries()) {
    errors.push(
      ...validateAsset(asset, input.projectionPeriodYears, "assets." + index),
    );
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const assetSchedules = input.assets.map((asset) =>
    calculateAssetScheduleUnchecked(asset, input.projectionPeriodYears),
  );

  return calculationSuccess({
    projectId: input.projectId,
    projectionPeriodYears: input.projectionPeriodYears,
    assetSchedules,
    yearlySummaries: summarizeDepreciationByYear(
      assetSchedules,
      input.projectionPeriodYears,
    ),
  });
}
