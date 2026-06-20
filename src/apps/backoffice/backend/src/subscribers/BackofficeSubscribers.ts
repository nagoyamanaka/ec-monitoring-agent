import { CollectMonitoringEventOnECEventPublished } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventOnECEventPublished.js";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { InvestigateAlertOnAlertClassifiedUnknown } from "../../../../../Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertOnAlertClassifiedUnknown.js";
import { InvestigateAlertUseCase } from "../../../../../Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertUseCase.js";
import { DomainEventSubscribers } from "../../../../../Contexts/Shared/infrastructure/EventBus/DomainEventSubscribers.js";

export function buildBackofficeSubscribers(
  collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
  investigateAlertUseCase: InvestigateAlertUseCase,
): DomainEventSubscribers {
  return new DomainEventSubscribers([
    new CollectMonitoringEventOnECEventPublished(collectMonitoringEventUseCase),
    new InvestigateAlertOnAlertClassifiedUnknown(investigateAlertUseCase),
  ]);
}
