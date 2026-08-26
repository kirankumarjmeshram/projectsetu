import type { ReportNarrative } from "../contracts";
import type { NarrativeProvider, NarrativeRequest } from "./provider";

export class DeterministicNarrativeProvider implements NarrativeProvider {
  readonly name = "deterministic-v1";

  async generate(request: NarrativeRequest): Promise<ReportNarrative> {
    const facts = request.facts;
    const text = (() => {
      switch (request.sectionId) {
        case "executive-summary":
          return `${facts.projectName} is presented as a ${facts.projectMode} project in ${facts.industryActivity}. The financial schedules and viability indicators in this report reproduce the approved ProjectSetu calculation snapshot.`;
        case "market-sales":
          return `The sales plan is based on the products, capacity utilisation, quantity growth and selling-price assumptions supplied for ${facts.projectName}. No external market growth statistic is asserted without an approved source.`;
        case "risks-mitigation":
          return "Key sensitivities include sales realization, input-cost movement, capacity ramp-up, debt servicing and implementation timing. Management should monitor actual performance against the stated assumptions and address deviations promptly.";
        case "conclusion":
          return "Bankability should be assessed from the complete financial schedules, defined and undefined ratios, identified risks, funding constraints and validation findings. This report is an analytical project document and does not constitute a sanction.";
        case "scheme-assistance":
          return `${facts.schemeSummary ?? "No government program has been selected."} Any calculated assistance remains subject to the applicable versioned rules, verification, approval, release conditions and sanction by the competent authority.`;
        case "funding-composition":
          return `${facts.fundingSummary ?? "The project is presented without scheme-composed funding."} Initial funding, deferred conditional assistance and non-cash benefits are shown separately.`;
        default:
          return `${request.sectionTitle} is based on the structured assumptions and authoritative snapshot values recorded for ${facts.projectName}.`;
      }
    })();
    return { text, provenance: "DETERMINISTIC", approved: true };
  }
}
