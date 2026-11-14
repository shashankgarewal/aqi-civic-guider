import { useEffect, useState } from 'react';
import { AlertCircle, FileSearch } from 'lucide-react';
import { AnalysisOutputView } from './components/AnalysisOutputView';
import { BriefingConfigBar } from './components/BriefingConfigBar';
import { DataIngestionPanel } from './components/DataIngestionPanel';
import { DeltaComparisonBanner } from './components/DeltaComparisonBanner';
import { TraceabilityDrawer } from './components/TraceabilityDrawer';
import type {
  AdvisoryLanguage,
  AirQualityBriefingResult,
  BuiltInPersona,
  IngestionMode,
  ReadingLevel,
  SavedBriefRecord,
  TraceableInputRow,
} from './types/airQuality';
import { getCpcbStyle } from './utils/cpcb';

const STORAGE_KEY = 'civic_aq_briefs_v1';

const CPCB_LEGEND_TIERS = [
  { label: '0–50 Good', aqi: 25 },
  { label: '51–100 Satisfactory', aqi: 75 },
  { label: '101–200 Moderate', aqi: 150 },
  { label: '201–300 Poor [GRAP-I]', aqi: 250 },
  { label: '301–400 Very Poor [GRAP-II]', aqi: 350 },
  { label: '401+ Severe [GRAP-III/IV]', aqi: 425 },
];

export default function App() {
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>('cpcb');
  const [traceableRows, setTraceableRows] = useState<TraceableInputRow[]>([]);
  const [cityOrArea, setCityOrArea] = useState('Delhi');

  const [selectedBuiltInPersona, setSelectedBuiltInPersona] =
    useState<BuiltInPersona>('Ward Officer');
  const [isCustomPersona, setIsCustomPersona] = useState(false);
  const [customPersonaText, setCustomPersonaText] = useState('');
  const [language, setLanguage] = useState<AdvisoryLanguage>('English');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(
    'Simple / Grade 5 (Easy-to-read community poster)',
  );

  const activePersona = isCustomPersona
    ? customPersonaText.trim() || 'Custom Civic Role'
    : selectedBuiltInPersona;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [savedBriefs, setSavedBriefs] = useState<SavedBriefRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [currentBriefId, setCurrentBriefId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedBriefRecord[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : null;
    } catch {
      return null;
    }
  });

  const [selectedCompareId, setSelectedCompareId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw) as SavedBriefRecord[];
      return Array.isArray(parsed) && parsed.length > 1 ? parsed[1].id : '';
    } catch {
      return '';
    }
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBriefs));
    } catch {
      // Ignore quota errors
    }
  }, [savedBriefs]);

  const currentBrief =
    savedBriefs.find((b) => b.id === currentBriefId) ?? savedBriefs[0] ?? null;

  const handleDataLoaded = (payload: {
    mode: IngestionMode;
    cityOrArea: string;
    rows: TraceableInputRow[];
  }) => {
    setTraceableRows(payload.rows);
    if (payload.cityOrArea) {
      setCityOrArea(payload.cityOrArea);
    }
    setHighlightedRowId(null);
    setAnalysisError(null);
  };

  const handleInspectRow = (rowId: string) => {
    setHighlightedRowId(rowId);
    setDrawerOpen(true);
  };

  const handleGenerateBriefing = async () => {
    if (traceableRows.length === 0) {
      setAnalysisError(
        'Please fetch live data, load a sample snapshot, or paste sensor data before generating a briefing.',
      );
      return;
    }

    if (isCustomPersona && !customPersonaText.trim()) {
      setAnalysisError(
        'Please enter a custom persona role title and operational scope before generating a briefing.',
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceableRows,
          sourceMode: ingestionMode,
          cityOrArea,
          persona: activePersona,
          language,
          readingLevel,
        }),
      });

      const rawText = await response.text();
      if (rawText.trim().startsWith('<')) {
        throw new Error(
          `Analysis endpoint returned an HTML page (HTTP ${response.status}) instead of JSON.`,
        );
      }
      const json = JSON.parse(rawText || '{}');
      if (!response.ok) {
        throw new Error(json.error || 'Failed to generate AI briefing.');
      }

      const briefing = json.briefing as AirQualityBriefingResult;
      const newRecord: SavedBriefRecord = {
        id: `brief-${Date.now()}`,
        createdAt: new Date().toISOString(),
        cityOrWard: briefing.cityOrArea || cityOrArea,
        sourceMode: ingestionMode,
        persona: activePersona,
        language,
        readingLevel,
        overallAqi: briefing.overallAqi,
        cpcbCategory: briefing.cpcbCategory,
        grapStage: briefing.grapStage,
        dominantPollutant: briefing.dominantPollutant,
        stationAqis: briefing.normalizedStations.map((s) => ({
          station: s.station,
          aqi: s.estimatedCpcbAqi,
          dominantPollutant: s.dominantPollutant,
          sourceRowId: s.sourceRowId,
        })),
        actions: briefing.actionPlan.map((a) => ({
          priority: a.priority,
          actionTitle: a.actionTitle,
        })),
        result: briefing,
      };

      const previousTopId = savedBriefs[0]?.id ?? '';
      setSavedBriefs((prev) => [newRecord, ...prev].slice(0, 20));
      setCurrentBriefId(newRecord.id);
      if (previousTopId) {
        setSelectedCompareId(previousTopId);
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unexpected analysis failure.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearHistory = () => {
    if (currentBrief) {
      setSavedBriefs([currentBrief]);
      setSelectedCompareId('');
    } else {
      setSavedBriefs([]);
      setSelectedCompareId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AQI Civic Guider
          </a>

          <nav
            aria-label="Primary workspace navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#ingestion"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Data Ingestion
            </a>
            <a
              href="#configuration"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Briefing Setup
            </a>
            <a
              href="#delta-history"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Delta History
            </a>
            <a
              href="#analysis-output"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Analysis Output
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSearch className="w-3.5 h-3.5" aria-hidden="true" />
              Raw Traceability ({traceableRows.length})
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero / Workspace Intro + CPCB Tier Legend */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Evidence-Audited Civic Air Quality Briefings
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
              Normalize multi-source CPCB, Google Air Quality, or messy ward
              sensor logs into GRAP-aligned operational action plans and
              multilingual citizen bulletins with row-level traceability.
            </p>
          </div>

          {/* CPCB AQI Scale Reference */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CPCB_LEGEND_TIERS.map((tier) => {
              const st = getCpcbStyle(tier.aqi);
              return (
                <span
                  key={tier.label}
                  className={`px-2 py-1 text-[11px] font-medium rounded border whitespace-nowrap ${st.badgeBg} ${st.badgeText} ${st.badgeBorder}`}
                >
                  {tier.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Step 1: Unified Data Ingestion */}
        <DataIngestionPanel
          activeMode={ingestionMode}
          onModeChange={setIngestionMode}
          traceableRows={traceableRows}
          highlightedRowId={highlightedRowId}
          onDataLoaded={handleDataLoaded}
        />

        {/* Step 2: Persona & Advisory Configuration */}
        <BriefingConfigBar
          selectedBuiltInPersona={selectedBuiltInPersona}
          onSelectBuiltInPersona={setSelectedBuiltInPersona}
          isCustomPersona={isCustomPersona}
          onToggleCustomPersona={setIsCustomPersona}
          customPersonaText={customPersonaText}
          onCustomPersonaTextChange={setCustomPersonaText}
          language={language}
          onLanguageChange={setLanguage}
          readingLevel={readingLevel}
          onReadingLevelChange={setReadingLevel}
          cityOrArea={cityOrArea}
          onCityOrAreaChange={setCityOrArea}
          rowCount={traceableRows.length}
          isAnalyzing={isAnalyzing}
          onGenerate={handleGenerateBriefing}
        />

        {/* Error Feedback */}
        {analysisError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-3"
          >
            <AlertCircle
              className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Analysis Error</p>
              <p className="text-xs text-red-800 mt-0.5">{analysisError}</p>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isAnalyzing && (
          <div
            aria-busy="true"
            aria-label="Generating audited briefing"
            className="space-y-6"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-7 w-2/3 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div className="h-10 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
              <div className="h-5 w-64 bg-slate-200 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
            </div>
          </div>
        )}

        {/* Delta Engine & Structured Output */}
        {!isAnalyzing && currentBrief && (
          <div className="space-y-8">
            <DeltaComparisonBanner
              currentBrief={currentBrief}
              savedBriefs={savedBriefs}
              selectedCompareId={selectedCompareId}
              onSelectCompareId={setSelectedCompareId}
              onClearHistory={handleClearHistory}
            />

            <AnalysisOutputView
              briefing={currentBrief.result}
              persona={currentBrief.persona}
              language={currentBrief.language}
              onInspectRow={handleInspectRow}
            />
          </div>
        )}

        {/* Empty State when no brief generated yet */}
        {!isAnalyzing && !currentBrief && (
          <section
            id="analysis-output"
            className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2"
          >
            <h2 className="text-base font-semibold text-slate-900">
              No briefing generated yet
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              Ingest live CPCB records, query Google Air Quality coordinates, or
              load the Messy Sample Table above, then select your target persona
              and click <span className="font-semibold">Generate Briefing</span>
              .
            </p>
          </section>
        )}
      </main>

      <TraceabilityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        rows={traceableRows}
        highlightedRowId={highlightedRowId}
        onSelectRow={(id) => setHighlightedRowId(id)}
      />
    </div>
  );
}
