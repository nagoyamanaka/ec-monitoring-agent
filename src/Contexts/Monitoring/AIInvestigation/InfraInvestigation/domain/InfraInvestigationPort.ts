import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { InfraEvidence } from "./InfraEvidence.js";

export interface InfraInvestigationPort {
  collect(monitoringEvent: MonitoringEvent): Promise<InfraEvidence>;
}
