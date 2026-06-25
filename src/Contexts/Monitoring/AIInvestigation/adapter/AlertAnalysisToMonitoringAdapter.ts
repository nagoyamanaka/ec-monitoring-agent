import type { InvestigationReport as AlertInvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";

export interface MonitoringInvestigationReport {
  id: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  findings: Array<{
    id: string;
    description: string;
    evidence?: string;
  }>;
  createdAt: string;
}

export function mapAlertToMonitoringReport(a: AlertInvestigationReport): MonitoringInvestigationReport {
  // Defensive mapping: AlertInvestigationReport shape may vary; use optional chaining and fallbacks.
  const anyA = a as any;
  const rawFindings = anyA.items ?? anyA.findings ?? [];

  return {
    id: anyA.reportId ?? anyA.id ?? 'unknown',
    summary: anyA.title ?? anyA.summary ?? anyA.description ?? '',
    severity: mapSeverity(anyA.score ?? anyA.severity ?? anyA.severityScore),
    findings: Array.isArray(rawFindings)
      ? rawFindings.map((it: any, idx: number) => ({
          id: it.id ?? it.key ?? String(idx),
          description: it.text ?? it.description ?? it.title ?? '',
          evidence: it.evidence ?? it.evidenceUrl ?? it.details,
        }))
      : [],
    createdAt: anyA.timestamp ?? anyA.createdAt ?? new Date().toISOString(),
  };
}

function mapSeverity(value: any): MonitoringInvestigationReport['severity'] {
  if (value == null) return 'low';
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v.includes('critical')) return 'critical';
    if (v.includes('high')) return 'high';
    if (v.includes('medium')) return 'medium';
    return 'low';
  }
  if (typeof value === 'number') {
    if (value >= 90) return 'critical';
    if (value >= 70) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  }
  return 'low';
}
