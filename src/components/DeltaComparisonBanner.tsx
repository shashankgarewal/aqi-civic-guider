import React from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  GitCompare,
  Trash2,
} from 'lucide-react';
import type { SavedBriefRecord } from '../types/airQuality';
import { computeBriefDelta, getCpcbStyle } from '../utils/cpcb';

interface DeltaComparisonBannerProps {
  currentBrief: SavedBriefRecord;
  savedBriefs: SavedBriefRecord[];
  selectedCompareId: string;
  onSelectCompareId: (id: string) => void;
  onClearHistory: () => void;
}

export const DeltaComparisonBanner: React.FC<DeltaComparisonBannerProps> = ({
  currentBrief,
  savedBriefs,
  selectedCompareId,
  onSelectCompareId,
  onClearHistory,
}) => {
  const previousCandidates = savedBriefs.filter((b) => b.id !== currentBrief.id);
  const previousBrief = previousCandidates.find(
    (b) => b.id === selectedCompareId,
  );

  const delta = React.useMemo(() => {
    if (!previousBrief) return null;
    return computeBriefDelta(currentBrief, previousBrief);
  }, [currentBrief, previousBrief]);

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <section
      id="delta-history"
      className="bg-white border border-slate-200 rounded-xl"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <GitCompare className="w-4 h-4 text-slate-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Brief-to-Brief Delta Engine
            </h2>
            <p className="text-xs text-slate-500">
              Compare current briefing against any saved snapshot in browser
              storage ({savedBriefs.length} saved).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="compare-brief-select" className="sr-only">
            Compare with Previous Brief
          </label>
          <select
            id="compare-brief-select"
            value={selectedCompareId}
            onChange={(e) => onSelectCompareId(e.target.value)}
            disabled={previousCandidates.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {previousCandidates.length === 0 ? (
              <option value="">
                Generate a 2nd brief to enable delta comparison
              </option>
            ) : (
              <>
                <option value="">Compare with Previous Brief...</option>
                {previousCandidates.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.cityOrWard} · AQI {b.overallAqi} ({b.persona}) ·{' '}
                    {formatTimestamp(b.createdAt)}
                  </option>
                ))}
              </>
            )}
          </select>

          {savedBriefs.length > 1 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1 cursor-pointer"
              title="Clear older saved briefs"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear History
            </button>
          )}
        </div>
      </div>

      {delta && previousBrief && (
        <div className="p-6 space-y-5">
          {/* Overall Delta Summary Banner */}
          <div
            className={`p-4 rounded-lg border flex flex-wrap items-center justify-between gap-4 ${
              delta.direction === 'worsened'
                ? 'bg-red-50 border-red-200 text-red-900'
                : delta.direction === 'improved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="space-y-1">
              <div className="text-xs font-medium opacity-80">
                Comparing against {previousBrief.cityOrWard} (
                {formatTimestamp(previousBrief.createdAt)})
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-bold font-mono tabular-nums inline-flex items-center gap-1.5">
                  {delta.direction === 'worsened' && (
                    <ArrowUpRight className="w-5 h-5 text-red-700" />
                  )}
                  {delta.direction === 'improved' && (
                    <ArrowDownRight className="w-5 h-5 text-emerald-700" />
                  )}
                  {delta.direction === 'unchanged' && (
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                  )}
                  {delta.overallDelta > 0
                    ? `+${delta.overallDelta} AQI Worsened`
                    : delta.overallDelta < 0
                      ? `${delta.overallDelta} AQI Improved`
                      : '0 AQI Unchanged'}
                </span>
                <span className="text-sm font-mono tabular-nums">
                  ({delta.previousAqi} → {delta.currentAqi})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`px-2.5 py-1 rounded border ${getCpcbStyle(delta.previousCategory).badgeBg} ${getCpcbStyle(delta.previousCategory).badgeText} ${getCpcbStyle(delta.previousCategory).badgeBorder}`}
              >
                Prev: {delta.previousCategory}
              </span>
              <span aria-hidden="true">→</span>
              <span
                className={`px-2.5 py-1 rounded border ${getCpcbStyle(delta.currentCategory).badgeBg} ${getCpcbStyle(delta.currentCategory).badgeText} ${getCpcbStyle(delta.currentCategory).badgeBorder}`}
              >
                Now: {delta.currentCategory}
              </span>
            </div>
          </div>

          {/* Station Shifts & Action Diff */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Station-by-Station Directional Shifts
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3 font-medium">Station</th>
                      <th className="py-2 px-3 text-right font-medium">Prev</th>
                      <th className="py-2 px-3 text-right font-medium">Now</th>
                      <th className="py-2 px-3 text-right font-medium">
                        Shift
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {delta.stationDeltas.map((st) => (
                      <tr key={st.station}>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {st.station}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {st.previousAqi ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {st.currentAqi}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {st.direction === 'new' && (
                            <span className="text-slate-600">New station</span>
                          )}
                          {st.direction === 'worsened' && (
                            <span className="text-red-700 font-semibold">
                              +{st.delta} Worsened
                            </span>
                          )}
                          {st.direction === 'improved' && (
                            <span className="text-emerald-700 font-semibold">
                              {st.delta} Improved
                            </span>
                          )}
                          {st.direction === 'unchanged' && (
                            <span className="text-slate-500">0 Unchanged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 gap-3">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="text-xs font-semibold text-red-800">
                  Newly Escalated Actions ({delta.newlyEscalatedActions.length})
                </div>
                {delta.newlyEscalatedActions.length === 0 ? (
                  <p className="text-xs text-slate-500 mt-1.5">
                    No new action escalations compared to previous brief.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-800">
                    {delta.newlyEscalatedActions.map((a, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[11px] font-semibold text-red-700 shrink-0">
                          {a.priority}
                        </span>
                        <span>{a.actionTitle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="text-xs font-semibold text-emerald-800">
                  Actions Ready to De-escalate (
                  {delta.deEscalatedActions.length})
                </div>
                {delta.deEscalatedActions.length === 0 ? (
                  <p className="text-xs text-slate-500 mt-1.5">
                    No prior interventions eligible for stand-down yet.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-800">
                    {delta.deEscalatedActions.map((a, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 shrink-0">
                          Stand-down
                        </span>
                        <span>{a.actionTitle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
