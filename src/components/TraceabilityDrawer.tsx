import React from 'react';
import { X } from 'lucide-react';
import type { TraceableInputRow } from '../types/airQuality';

interface TraceabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rows: TraceableInputRow[];
  highlightedRowId: string | null;
  onSelectRow: (rowId: string) => void;
}

export const TraceabilityDrawer: React.FC<TraceabilityDrawerProps> = ({
  isOpen,
  onClose,
  rows,
  highlightedRowId,
  onSelectRow,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
      role="dialog"
      aria-modal="true"
      aria-label="Raw Input Traceability Inspector"
    >
      <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Raw Input Traceability Inspector
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify every metric, gap, and directive against the exact raw
              ingested record.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close traceability drawer"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No raw rows loaded in this session.
            </p>
          ) : (
            rows.map((row) => {
              const active = highlightedRowId === row.rowId;
              return (
                <div
                  key={row.rowId}
                  onClick={() => onSelectRow(row.rowId)}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {row.rowId}
                    </span>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {row.timestamp}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mt-1">
                    {row.station}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {row.summary}
                  </div>
                  <pre className="mt-2.5 p-2.5 bg-slate-100 rounded text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
                    {row.rawText}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
