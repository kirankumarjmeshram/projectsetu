import type { Applicant } from "../applicant/applicant";
import type { BusinessEntity } from "../business/business-entity";
import type { ProjectCost } from "../project-cost/project-cost";
import type { Project } from "../project/project";
import type { SourceReference } from "../shared/provenance";

export const sampleUserSource: SourceReference = {
  id: "source-synthetic-user-input",
  type: "USER_INPUT",
  reference: "Synthetic test fixture",
  notes: "Contains no customer or private data.",
};

export const sampleProject: Project = {
  id: "project-sample-manufacturing",
  name: "Sample Manufacturing Project",
  mode: "BANKABLE",
  industryActivity: "Synthetic manufacturing activity",
  stage: "PLANNING",
  status: "DRAFT",
  location: {
    address: {
      lines: ["Example Industrial Area"],
      villageTownCity: "Demo City",
      district: "Example District",
      state: "Example State",
      pinCode: "000000",
    },
    areaClassification: "UNCLASSIFIED",
  },
  projectionPeriodYears: 5,
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

export const exampleApplicant: Applicant = {
  id: "applicant-example",
  type: "INDIVIDUAL",
  name: "Example Applicant",
  education: ["Synthetic qualification"],
  contributionCapacity: {
    value: "100000.00",
    source: sampleUserSource,
  },
};

export const demoBusinessEntity: BusinessEntity = {
  id: "business-demo",
  name: "Demo Business Entity",
  legalForm: "PROPRIETORSHIP",
  enterpriseStatus: "NEW",
};

export const sampleProjectCost: ProjectCost = {
  projectId: sampleProject.id,
  items: [
    {
      id: "cost-demo-equipment",
      description: "Demo Equipment",
      category: "EQUIPMENT",
      amount: {
        value: "250000.00",
        source: sampleUserSource,
      },
    },
  ],
  statedTotal: "250000.00",
};
