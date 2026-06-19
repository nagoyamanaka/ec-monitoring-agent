import { InvestigationContext } from "./InvestigationContext.js";
import { InvestigationReport } from "../../AlertAnalysis/domain/InvestigationReport.js";

export interface AIInvestigationPort {
  investigate(context: InvestigationContext): Promise<InvestigationReport>;
}
