import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Info,
  Link2,
  MessageSquareShare,
} from 'lucide-react';
import type {
  AdvisoryLanguage,
  AirQualityBriefingResult,
  TargetPersona,
} from '../types/airQuality';
import { getCpcbStyle } from '../utils/cpcb';

interface AnalysisOutputViewProps {
  briefing: AirQualityBriefingResult;
  persona: TargetPersona;
  language: AdvisoryLanguage;
  onInspectRow: (rowId: string) => void;
}

export const AnalysisOutputView: React.FC<AnalysisOutputViewProps> = ({
  briefing,
  persona,
  language,
  onInspectRow,
}) => {
  const [activeDocTab, setActiveDocTab] = useState<'memo' | 'advisory'>(
    'memo',
  );
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAdvisory, setCopiedAdvisory] = useState(false);

  const overallStyle = getCpcbStyle(
    briefing.cpcbCategory || briefing.overallAqi,
  );

  const buildMemoMarkdown = () => {
    const h = briefing.internalBriefingNote.memoHeader;
    const directives = briefing.internalBriefingNote.operationalDirectives
      .map((d, i) => `${i + 1}. ${d}`)
      .join('\n');
    const warnings = briefing.internalBriefingNote.sensorWarnings
      .map((w) => `- ${w}`)
      .join('\n');
    const traceRows = briefing.normalizedStations
      .map(
        (s) =>
          `| ${s.sourceRowId} | ${s.station} | ${s.estimatedCpcbAqi} (${s.cpcbCategory}) | ${s.dominantPollutant} | ${s.reliabilityStatus} |`,
      )
      .join('\n');

    return `# INTERNAL CIVIC AIR QUALITY BRIEFING NOTE

- **TO:** ${h.to}
- **FROM:** ${h.from}
- **SUBJECT:** ${h.subject}
- **WINDOW:** ${h.dateAndWindow}
- **SEVERITY:** ${h.severityClassification}

## Situation Overview
${briefing.internalBriefingNote.situationOverview}

## Station Traceability Summary
${briefing.internalBriefingNote.stationTraceabilitySummary}

| Source Row | Station | Estimated CPCB AQI | Dominant Pollutant | Reliability |
|---|---|---|---|---|
${traceRows}

## Flagged Sensor Warnings & Data Hygiene
${warnings || '- No critical sensor reliability warnings.'}

## Operational Directives (${persona})
${directives}
`;
  };

  const buildAdvisoryText = () => {
    const c = briefing.citizenAdvisory;
    return `${c.bulletinTitle}
(${c.language} · ${c.readingLevel})

${c.mainMessage}

CHILDREN:
${c.callouts.children}

OLDER ADULTS:
${c.callouts.olderAdults}

PEOPLE SENSITIVE TO POOR AIR (ASTHMA / COPD / HEART):
${c.callouts.sensitiveGroups}

---
WHATSAPP / NOTICE-BOARD SHAREABLE TEXT:
${c.whatsappShareText}

Sources cited: ${c.citations.join(', ')}`;
  };

  const copyToClipboard = async (
    text: string,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render inline [ROW-XX] citations as clickable traceability buttons
  const renderTextWithCitations = (text: string) => {
    const parts = text.split(/(\[[^\]]*ROW-\d+[^\]]*\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/ROW-\d+/);
      if (part.startsWith('[') && part.endsWith(']') && match) {
        const rowId = match[0];
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onInspectRow(rowId)}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 text-[11px] font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer align-baseline"
            title={`Inspect ${rowId} in Raw Input Drawer`}
          >
            <Link2 className="w-3 h-3" aria-hidden="true" />
            {part.slice(1, -1)}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const getPriorityBadgeStyle = (priority: string) => {
    if (priority === 'P1 Immediate') {
      return 'bg-red-50 text-red-800 border-red-200';
    }
    if (priority === 'P2 Today') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div id="analysis-output" className="space-y-8">
      {/* Executive Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{briefing.cityOrArea}</span>
              <span aria-hidden="true">·</span>
              <span>{persona}</span>
              <span aria-hidden="true">·</span>
              <span>{language} Bulletin</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1 text-balance">
              {briefing.summaryHeadline}
            </h2>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">
              {briefing.executiveSummary}
            </p>
          </div>

          <div
            className={`px-4 py-3 rounded-lg border shrink-0 ${overallStyle.badgeBg} ${overallStyle.badgeText} ${overallStyle.badgeBorder}`}
          >
            <div className="text-xs font-medium opacity-85">
              Indian CPCB AQI · {overallStyle.rangeLabel}
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums mt-0.5">
              {briefing.overallAqi}
            </div>
            <div className="text-xs font-semibold mt-0.5">
              {briefing.cpcbCategory}
            </div>
          </div>
        </div>

        {/* 4-column metric strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500">GRAP Activation Tier</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {briefing.grapStage}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Dominant Pollutant</div>
            <div className="text-sm font-semibold font-mono text-slate-900 mt-0.5">
              {briefing.dominantPollutant}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">
              Stations / Rows Audited
            </div>
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
              {briefing.normalizedStations.length} stations
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">
              Flagged Gaps & Anomalies
            </div>
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
              {briefing.dataGapsAndAnomalies.length} issues detected
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Data Hygiene & Reliability Audit */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            01. Data Hygiene & CPCB Reliability Audit
          </h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Unit-normalized station readings and flagged sensor anomalies.
            Click any <span className="font-mono">ROW-XX</span> badge to verify
            against raw input.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-3">Source Row</th>
                  <th className="py-2.5 px-3">Station & Timestamp</th>
                  <th className="py-2.5 px-3">Normalized Readings</th>
                  <th className="py-2.5 px-3 text-right">CPCB AQI</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Reliability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {briefing.normalizedStations.map((st, idx) => {
                  const stStyle = getCpcbStyle(
                    st.cpcbCategory || st.estimatedCpcbAqi,
                  );
                  return (
                    <tr
                      key={`${st.sourceRowId}-${idx}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="py-3 px-3 align-top">
                        <button
                          type="button"
                          onClick={() => onInspectRow(st.sourceRowId)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" aria-hidden="true" />
                          {st.sourceRowId}
                        </button>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-medium text-slate-900">
                          {st.station}
                        </div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                          {st.timestamp}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="text-xs font-mono text-slate-800">
                          {st.normalizedPollutantsSummary}
                        </div>
                        {st.notes && (
                          <div className="text-xs text-slate-500 mt-1">
                            {st.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums font-bold text-slate-900">
                        {st.estimatedCpcbAqi}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${stStyle.badgeBg} ${stStyle.badgeText} ${stStyle.badgeBorder}`}
                        >
                          {st.cpcbCategory}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap text-xs font-medium">
                        <span
                          className={
                            st.reliabilityStatus === 'Verified'
                              ? 'text-emerald-700'
                              : st.reliabilityStatus === 'Partial'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }
                        >
                          {st.reliabilityStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Data Gaps & Unreliable Readings */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertTriangle
                className="w-4 h-4 text-amber-600"
                aria-hidden="true"
              />
              Data Gaps & Unreliable Readings (
              {briefing.dataGapsAndAnomalies.length})
            </h4>

            {briefing.dataGapsAndAnomalies.length === 0 ? (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                All ingested rows passed unit consistency, timestamp freshness,
                and plausibility checks.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {briefing.dataGapsAndAnomalies.map((gap, idx) => (
                  <div
                    key={`${gap.sourceRowId}-${idx}`}
                    className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-900">
                        {gap.issueType} · {gap.station}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInspectRow(gap.sourceRowId)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-white text-blue-800 border border-blue-200 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Link2 className="w-3 h-3" aria-hidden="true" />
                        {gap.sourceRowId}
                      </button>
                    </div>
                    <div className="text-xs font-mono text-slate-700 bg-white px-2.5 py-1.5 rounded border border-amber-200/70 break-all">
                      Raw excerpt: {gap.rawValueExcerpt}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {gap.explanation}
                    </p>
                    <p className="text-xs font-medium text-amber-950">
                      Briefing impact: {gap.impactOnBriefing}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Hotspots & Plain-Language Trend Summary */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            02. Hotspots & Plain-Language Trend Summary
          </h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Worst-affected stations, dominant pollutants, and likely local
            emission drivers with inline row citations.
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {briefing.hotspotFindings.map((finding, idx) => (
            <div key={idx} className="p-6 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {finding.station} · Dominant: {finding.dominantPollutant} ·{' '}
                    <span className="font-mono tabular-nums text-slate-700">
                      {finding.aqiOrReading}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                    {finding.title}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {finding.citations.map((cit) => (
                    <button
                      key={cit}
                      type="button"
                      onClick={() => onInspectRow(cit)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" aria-hidden="true" />
                      {cit}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                {renderTextWithCitations(finding.plainLanguageSummary)}
              </p>

              <div className="text-xs text-slate-600 pt-1">
                <span className="font-semibold text-slate-800">
                  Likely local source:
                </span>{' '}
                {finding.likelyLocalSource}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Prioritized Persona Action Plan */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            03. Prioritized Action Plan — {persona}
          </h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Targeted operational interventions calibrated to{' '}
            {briefing.cpcbCategory} ({briefing.grapStage}) and dominant
            pollutant drivers.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {briefing.actionPlan.map((act, idx) => (
            <div
              key={idx}
              className="p-5 rounded-lg border border-slate-200 bg-white flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded border ${getPriorityBadgeStyle(act.priority)}`}
                  >
                    {act.priority}
                  </span>

                  <button
                    type="button"
                    onClick={() => onInspectRow(act.sourceRowId)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3 h-3" aria-hidden="true" />
                    {act.sourceRowId}
                  </button>
                </div>

                <h4 className="text-base font-semibold text-slate-900">
                  {act.actionTitle}
                </h4>

                <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                  {act.operationalSteps.map((step, sIdx) => (
                    <li key={sIdx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 text-xs space-y-1">
                <div className="text-slate-700">
                  <span className="font-semibold text-slate-900">
                    Triggering Evidence:
                  </span>{' '}
                  <span className="font-mono">{act.triggeringEvidence}</span>
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-800">
                    Pollutant Rationale:
                  </span>{' '}
                  {act.dominantPollutantRationale}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Dual-Format Outputs (Internal Briefing Note & Multilingual Citizen Advisory) */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              04. Dual-Format Deliverables
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">
              Switch between the formal operational memo and the shareable{' '}
              {briefing.citizenAdvisory.language} community advisory.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Output format tabs"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeDocTab === 'memo'}
              onClick={() => setActiveDocTab('memo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                activeDocTab === 'memo'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Tab A: Internal Briefing Note
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDocTab === 'advisory'}
              onClick={() => setActiveDocTab('advisory')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                activeDocTab === 'advisory'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquareShare
                className="w-3.5 h-3.5"
                aria-hidden="true"
              />
              Tab B: {briefing.citizenAdvisory.language} Citizen Advisory
            </button>
          </div>
        </div>

        {/* TAB A: INTERNAL BRIEFING NOTE */}
        {activeDocTab === 'memo' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-500">
                Formal Operational Memorandum · {persona}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(buildMemoMarkdown(), setCopiedMemo)
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMemo ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedMemo ? 'Copied Memo' : 'Copy Memo'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `internal-briefing-note-${briefing.cityOrArea.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
                      buildMemoMarkdown(),
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .MD
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 p-5 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-600">TO:</span>{' '}
                  <span className="text-slate-900">
                    {briefing.internalBriefingNote.memoHeader.to}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">FROM:</span>{' '}
                  <span className="text-slate-900">
                    {briefing.internalBriefingNote.memoHeader.from}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="font-semibold text-slate-600">SUBJECT:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {briefing.internalBriefingNote.memoHeader.subject}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">WINDOW:</span>{' '}
                  <span className="font-mono text-slate-800">
                    {briefing.internalBriefingNote.memoHeader.dateAndWindow}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">
                    SEVERITY:
                  </span>{' '}
                  <span className="font-semibold text-slate-900">
                    {
                      briefing.internalBriefingNote.memoHeader
                        .severityClassification
                    }
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1.5">
                    Situation Overview
                  </h4>
                  <p>{briefing.internalBriefingNote.situationOverview}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1.5">
                    Station Traceability Summary
                  </h4>
                  <p>
                    {briefing.internalBriefingNote.stationTraceabilitySummary}
                  </p>
                </div>

                {briefing.internalBriefingNote.sensorWarnings.length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <h4 className="text-xs font-semibold text-amber-900 mb-1.5">
                      Flagged Sensor Warnings
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-amber-950">
                      {briefing.internalBriefingNote.sensorWarnings.map(
                        (w, i) => (
                          <li key={i}>{w}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">
                    Operational Directives
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    {briefing.internalBriefingNote.operationalDirectives.map(
                      (dir, i) => (
                        <li key={i}>{dir}</li>
                      ),
                    )}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB B: MULTILINGUAL CITIZEN ADVISORY */}
        {activeDocTab === 'advisory' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Language:{' '}
                <span className="font-semibold text-slate-900">
                  {briefing.citizenAdvisory.language}
                </span>{' '}
                · Level:{' '}
                <span className="font-semibold text-slate-900">
                  {briefing.citizenAdvisory.readingLevel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      briefing.citizenAdvisory.whatsappShareText,
                      setCopiedAdvisory,
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedAdvisory ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedAdvisory
                    ? 'Copied WhatsApp Text'
                    : 'Copy for WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `citizen-advisory-${briefing.citizenAdvisory.language.toLowerCase()}.txt`,
                      buildAdvisoryText(),
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Notice
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 space-y-6 bg-slate-50/40">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded border ${overallStyle.badgeBg} ${overallStyle.badgeText} ${overallStyle.badgeBorder}`}
                  >
                    AQI {briefing.overallAqi} · {briefing.cpcbCategory}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {briefing.citizenAdvisory.citations.map((cit) => (
                      <button
                        key={cit}
                        type="button"
                        onClick={() => onInspectRow(cit)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-white text-blue-800 border border-blue-200 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Link2 className="w-3 h-3" aria-hidden="true" />
                        {cit}
                      </button>
                    ))}
                  </div>
                </div>
                <h4 className="text-xl font-bold text-slate-900">
                  {briefing.citizenAdvisory.bulletinTitle}
                </h4>
                <p className="text-base text-slate-800 leading-relaxed">
                  {briefing.citizenAdvisory.mainMessage}
                </p>
              </div>

              {/* 3 Dedicated Vulnerability Callout Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1.5">
                  <div className="text-xs font-semibold text-blue-800">
                    Children
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {briefing.citizenAdvisory.callouts.children}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1.5">
                  <div className="text-xs font-semibold text-amber-800">
                    Older Adults
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {briefing.citizenAdvisory.callouts.olderAdults}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1.5">
                  <div className="text-xs font-semibold text-red-800">
                    People Sensitive to Poor Air (Asthma / COPD / Heart)
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {briefing.citizenAdvisory.callouts.sensitiveGroups}
                  </p>
                </div>
              </div>

              {/* WhatsApp / Notice-board Ready Text */}
              <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  Ready-to-Forward WhatsApp / Notice-Board Text
                </div>
                <pre className="text-sm font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {briefing.citizenAdvisory.whatsappShareText}
                </pre>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
