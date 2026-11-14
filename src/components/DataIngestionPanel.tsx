import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Database,
  FileSpreadsheet,
  Globe,
  MapPin,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  CPCB_PRESET_CITIES,
  DEFAULT_CPCB_API_KEY,
  SAMPLE_GOOGLE_AQ_RESPONSE,
  SAMPLE_MESSY_TABLE_TEXT,
} from '../data/sampleDatasets';
import type {
  CpcbRawRecord,
  GoogleAqResponse,
  IngestionMode,
  TraceableInputRow,
} from '../types/airQuality';
import {
  buildTraceableRowsFromGoogleAq,
  buildTraceableRowsFromMessyText,
  groupCpcbRecords,
  isNumericReading,
} from '../utils/cpcb';

interface DataIngestionPanelProps {
  activeMode: IngestionMode;
  onModeChange: (mode: IngestionMode) => void;
  traceableRows: TraceableInputRow[];
  highlightedRowId: string | null;
  onDataLoaded: (payload: {
    mode: IngestionMode;
    cityOrArea: string;
    rows: TraceableInputRow[];
    cpcbRecords?: CpcbRawRecord[];
    googleAqData?: GoogleAqResponse | null;
    messyText?: string;
  }) => void;
}

const GOOGLE_AQ_PRESETS = [
  { label: 'Delhi (Connaught Place)', lat: 28.6315, lng: 77.2167 },
  { label: 'Mumbai (Bandra Kurla)', lat: 19.0653, lng: 72.8679 },
  { label: 'Bengaluru (MG Road)', lat: 12.9756, lng: 77.6066 },
];

export const DataIngestionPanel: React.FC<DataIngestionPanelProps> = ({
  activeMode,
  onModeChange,
  traceableRows,
  highlightedRowId,
  onDataLoaded,
}) => {
  // Mode 1: CPCB state
  const [cpcbApiKey, setCpcbApiKey] = useState(DEFAULT_CPCB_API_KEY);
  const [selectedCityPreset, setSelectedCityPreset] = useState<string>('Delhi');
  const [customCity, setCustomCity] = useState('');
  const [cpcbRecords, setCpcbRecords] = useState<CpcbRawRecord[]>([]);
  const [cpcbLoading, setCpcbLoading] = useState(false);
  const [cpcbError, setCpcbError] = useState<string | null>(null);
  const [cpcbMeta, setCpcbMeta] = useState<string | null>(null);
  const [hideNaRows, setHideNaRows] = useState(false);
  const [showRawCpcbSample, setShowRawCpcbSample] = useState(false);

  // Mode 2: Google AQ state
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [latInput, setLatInput] = useState('28.6315');
  const [lngInput, setLngInput] = useState('77.2167');
  const [googleAqData, setGoogleAqData] = useState<GoogleAqResponse | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Mode 3: Messy Data state
  const [messyText, setMessyText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveCity =
    selectedCityPreset === 'Custom'
      ? customCity.trim() || 'Delhi'
      : selectedCityPreset;

  async function safeParseJson(response: Response, label: string) {
    const rawText = await response.text();
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<')) {
      throw new Error(
        `${label} returned an HTML page (HTTP ${response.status}) instead of JSON.`,
      );
    }
    try {
      return JSON.parse(trimmed || '{}');
    } catch {
      throw new Error(
        `${label} returned invalid JSON (HTTP ${response.status}).`,
      );
    }
  }

  const handleFetchCpcb = async () => {
    const key = cpcbApiKey.trim();
    if (!key) {
      setCpcbError('Please enter a data.gov.in CPCB API key.');
      return;
    }

    setCpcbLoading(true);
    setCpcbError(null);

    try {
      let records: CpcbRawRecord[] | null = null;
      let directErrorMsg: string | null = null;

      // 1. Try direct browser fetch first (avoids cloud datacenter IP blocks on data.gov.in)
      try {
        const directUrl = new URL(
          'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69',
        );
        directUrl.searchParams.set('api-key', key);
        directUrl.searchParams.set('format', 'json');
        directUrl.searchParams.set('limit', '500');
        directUrl.searchParams.set('filters[city]', effectiveCity);

        const directRes = await fetch(directUrl.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const directJson = (await safeParseJson(
          directRes,
          'data.gov.in CPCB API',
        )) as { records?: CpcbRawRecord[]; message?: string; error?: string };

        if (!directRes.ok) {
          throw new Error(
            directJson.message ||
              directJson.error ||
              `data.gov.in returned HTTP ${directRes.status}`,
          );
        }
        if (!Array.isArray(directJson.records)) {
          throw new Error(
            directJson.message || 'Unexpected data.gov.in response structure.',
          );
        }
        records = directJson.records;
      } catch (directErr) {
        directErrorMsg =
          directErr instanceof Error ? directErr.message : 'Direct fetch failed';
      }

      // 2. Fallback to backend Express proxy if direct browser request failed (e.g., CORS)
      if (records === null) {
        const proxyRes = await fetch('/api/cpcb/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key, city: effectiveCity }),
        });
        const proxyJson = (await safeParseJson(
          proxyRes,
          'CPCB Proxy Endpoint',
        )) as { records?: CpcbRawRecord[]; error?: string };

        if (!proxyRes.ok) {
          throw new Error(
            proxyJson.error ||
              directErrorMsg ||
              'Failed to fetch CPCB records.',
          );
        }
        records = proxyJson.records || [];
      }

      if (records.length === 0) {
        setCpcbRecords([]);
        setCpcbError(
          `No live CPCB stations returned for "${effectiveCity}". Verify city spelling (e.g., Delhi, Bhopal, Mumbai) or try another city.`,
        );
        return;
      }

      const { traceableRows: rows } = groupCpcbRecords(records);
      setCpcbRecords(records);
      setCpcbMeta(
        `Live feed · ${records.length} pollutant rows · ${effectiveCity}`,
      );
      onDataLoaded({
        mode: 'cpcb',
        cityOrArea: effectiveCity,
        rows,
        cpcbRecords: records,
      });
    } catch (err) {
      setCpcbError(
        err instanceof Error
          ? err.message
          : 'Live CPCB request failed. Verify your API key and city filter.',
      );
    } finally {
      setCpcbLoading(false);
    }
  };

  const handleFetchGoogleAq = async () => {
    const key = googleApiKey.trim();
    if (!key) {
      setGoogleError('Please enter a Google Maps Air Quality API key.');
      return;
    }

    setGoogleLoading(true);
    setGoogleError(null);
    const lat = Number(latInput);
    const lng = Number(lngInput);

    try {
      let aqData: GoogleAqResponse | null = null;
      let directErrorMsg: string | null = null;

      try {
        const directRes = await fetch(
          `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: { latitude: lat, longitude: lng },
              extraComputations: [
                'HEALTH_RECOMMENDATIONS',
                'DOMINANT_POLLUTANT_CONCENTRATION',
                'LOCAL_AQI',
              ],
            }),
          },
        );
        const directJson = (await safeParseJson(
          directRes,
          'Google Air Quality API',
        )) as GoogleAqResponse & { error?: { message?: string } };

        if (!directRes.ok) {
          throw new Error(
            directJson.error?.message ||
              `Google Air Quality API returned HTTP ${directRes.status}`,
          );
        }
        aqData = directJson;
      } catch (directErr) {
        directErrorMsg =
          directErr instanceof Error
            ? directErr.message
            : 'Direct Google AQ fetch failed';
      }

      if (aqData === null) {
        const response = await fetch('/api/google-aq/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: key,
            latitude: lat,
            longitude: lng,
          }),
        });
        const json = (await safeParseJson(
          response,
          'Google AQ Proxy Endpoint',
        )) as GoogleAqResponse & { error?: string };
        if (!response.ok) {
          throw new Error(
            json.error ||
              directErrorMsg ||
              'Google Air Quality API request failed.',
          );
        }
        aqData = json;
      }

      const rows = buildTraceableRowsFromGoogleAq(aqData, lat, lng);
      setGoogleAqData(aqData);
      onDataLoaded({
        mode: 'google_aq',
        cityOrArea: `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        rows,
        googleAqData: aqData,
      });
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : 'Google Air Quality fetch failed.',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoadSampleGoogleAq = () => {
    setGoogleError(null);
    const lat = Number(latInput) || 28.6315;
    const lng = Number(lngInput) || 77.2167;
    const rows = buildTraceableRowsFromGoogleAq(
      SAMPLE_GOOGLE_AQ_RESPONSE,
      lat,
      lng,
    );
    setGoogleAqData(SAMPLE_GOOGLE_AQ_RESPONSE);
    onDataLoaded({
      mode: 'google_aq',
      cityOrArea: `Delhi (${lat.toFixed(4)}, ${lng.toFixed(4)} Sample)`,
      rows,
      googleAqData: SAMPLE_GOOGLE_AQ_RESPONSE,
    });
  };

  const handleMessyTextUpdate = (nextText: string, fileLabel?: string) => {
    setMessyText(nextText);
    if (fileLabel !== undefined) setUploadedFileName(fileLabel);
    const rows = buildTraceableRowsFromMessyText(nextText);
    onDataLoaded({
      mode: 'messy',
      cityOrArea: fileLabel ? `Uploaded: ${fileLabel}` : 'Ward Sensor Table',
      rows,
      messyText: nextText,
    });
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      handleMessyTextUpdate(text, file.name);
    };
    reader.readAsText(file);
  };

  const groupedCpcbResult = React.useMemo(
    () => groupCpcbRecords(cpcbRecords),
    [cpcbRecords],
  );
  const groupedCpcb = groupedCpcbResult.grouped;
  const validCpcbRowCount = groupedCpcbResult.validRowCount;

  const displayedCpcbGroups = React.useMemo(() => {
    if (!hideNaRows) return groupedCpcb;
    return groupedCpcb
      .map((g) => ({
        ...g,
        readings: g.readings.filter(
          (r) =>
            isNumericReading(r.pollutant_avg) ||
            isNumericReading(r.pollutant_min) ||
            isNumericReading(r.pollutant_max),
        ),
      }))
      .filter((g) => g.readings.length > 0);
  }, [groupedCpcb, hideNaRows]);

  return (
    <section
      id="ingestion"
      className="bg-white border border-slate-200 rounded-xl"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            01. Data Ingestion & Source Telemetry
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Ingest live CPCB station feeds, Google Air Quality coordinates, or
            unstandardized ward tables. Every row receives a traceable ID.
          </p>
        </div>

        {/* Segmented Ingestion Tabs */}
        <div
          role="tablist"
          aria-label="Data ingestion mode"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'cpcb'}
            onClick={() => onModeChange('cpcb')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'cpcb'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            Live India CPCB
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'google_aq'}
            onClick={() => onModeChange('google_aq')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'google_aq'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            Google Air Quality
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'messy'}
            onClick={() => onModeChange('messy')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'messy'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            Upload / Paste Messy Data
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* TAB 1: LIVE INDIA CPCB FEED */}
        {activeMode === 'cpcb' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-7">
                <label
                  htmlFor="cpcb-api-key"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  data.gov.in CPCB API Key
                </label>
                <input
                  id="cpcb-api-key"
                  type="text"
                  value={cpcbApiKey}
                  onChange={(e) => setCpcbApiKey(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  placeholder="Enter data.gov.in API key"
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="cpcb-city-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  City Filter
                </label>
                <select
                  id="cpcb-city-select"
                  value={selectedCityPreset}
                  onChange={(e) => setSelectedCityPreset(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {CPCB_PRESET_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="Custom">Custom City...</option>
                </select>
              </div>

              <div className="lg:col-span-3 flex items-center">
                <button
                  type="button"
                  onClick={handleFetchCpcb}
                  disabled={cpcbLoading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${cpcbLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {cpcbLoading ? 'Fetching CPCB...' : 'Fetch Live CPCB Data'}
                </button>
              </div>

              {selectedCityPreset === 'Custom' && (
                <div className="lg:col-span-5">
                  <label
                    htmlFor="cpcb-custom-city"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Custom City Name
                  </label>
                  <input
                    id="cpcb-custom-city"
                    type="text"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="e.g. Gurugram, Patna, Pune"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
            </div>

            {cpcbError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertCircle
                  className="w-4 h-4 mt-0.5 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="font-medium">CPCB Feed Notice</p>
                  <p className="text-xs text-red-700 mt-0.5">{cpcbError}</p>
                </div>
              </div>
            )}

            {groupedCpcb.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {groupedCpcb.length} stations ·{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {validCpcbRowCount} numeric
                      </span>{' '}
                      /{' '}
                      <span className="font-mono text-slate-500">
                        {cpcbRecords.length - validCpcbRowCount} NA
                      </span>{' '}
                      readings
                    </span>
                    {cpcbMeta && (
                      <span className="font-mono text-slate-500">
                        · {cpcbMeta}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHideNaRows((v) => !v)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        hideNaRows
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {hideNaRows
                        ? 'Showing Valid Readings Only'
                        : 'Hide NA Readings'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRawCpcbSample((v) => !v)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {showRawCpcbSample
                        ? 'Hide Raw API Record'
                        : 'Inspect Raw API Record'}
                    </button>
                  </div>
                </div>

                {validCpcbRowCount === 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    The data.gov.in CPCB feed returned {cpcbRecords.length} rows
                    for {effectiveCity}, and all pollutant values in this live
                    hourly batch are currently reported as{' '}
                    <span className="font-mono font-semibold">NA</span> by the
                    upstream station sensors. Try another city (e.g. Mumbai,
                    Bengaluru, Lucknow) or inspect the raw API record below.
                  </div>
                )}

                {showRawCpcbSample && cpcbRecords[0] && (
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(cpcbRecords[0], null, 2)}
                  </pre>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                        <th className="py-2.5 px-3">Row ID</th>
                        <th className="py-2.5 px-3">Station & Last Update</th>
                        <th className="py-2.5 px-3">Pollutant</th>
                        <th className="py-2.5 px-3 text-right">Min</th>
                        <th className="py-2.5 px-3 text-right">Max</th>
                        <th className="py-2.5 px-3 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {displayedCpcbGroups.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 px-4 text-center text-xs text-slate-500"
                          >
                            All rows in this live snapshot have NA readings.
                            Toggle &ldquo;Showing Valid Readings Only&rdquo; off
                            to view the raw NA rows.
                          </td>
                        </tr>
                      ) : (
                        displayedCpcbGroups.map((group) =>
                          group.readings.map((reading, rIdx) => {
                            const isHighlighted =
                              highlightedRowId === reading.rowId;
                            return (
                              <tr
                                key={reading.rowId}
                                className={`transition-colors ${
                                  isHighlighted
                                    ? 'bg-blue-50'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                                  {reading.rowId}
                                </td>
                                <td className="py-2 px-3">
                                  {rIdx === 0 ? (
                                    <div>
                                      <div className="font-medium text-slate-900">
                                        {group.station}
                                      </div>
                                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                                        {group.city} · {group.lastUpdate}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      ↳ {group.station}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-xs font-medium text-slate-800">
                                  {reading.pollutant_id}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {reading.pollutant_min ?? 'NA'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {reading.pollutant_max ?? 'NA'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {reading.pollutant_avg ?? 'NA'}
                                </td>
                              </tr>
                            );
                          }),
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                <p className="text-sm font-medium text-slate-800">
                  No CPCB station records loaded yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Click &ldquo;Fetch Live CPCB Data&rdquo; above to retrieve
                  live station telemetry from data.gov.in for your selected
                  city.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GOOGLE AIR QUALITY API */}
        {activeMode === 'google_aq' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-12">
                <label
                  htmlFor="google-aq-key"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Google Maps Air Quality API Key
                </label>
                <input
                  id="google-aq-key"
                  type="text"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  placeholder="Enter Google Maps Air Quality API Key"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              <div className="lg:col-span-4">
                <label
                  htmlFor="aq-lat"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Latitude
                </label>
                <input
                  id="aq-lat"
                  type="number"
                  step="0.0001"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="lg:col-span-4">
                <label
                  htmlFor="aq-lng"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Longitude
                </label>
                <input
                  id="aq-lng"
                  type="number"
                  step="0.0001"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchGoogleAq}
                  disabled={googleLoading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {googleLoading ? 'Querying...' : 'Fetch Google AQ'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>Quick Coordinates:</span>
                {GOOGLE_AQ_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setLatInput(String(preset.lat));
                      setLngInput(String(preset.lng));
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleLoadSampleGoogleAq}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Load Sample Google AQ Response
              </button>
            </div>

            {googleError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertCircle
                  className="w-4 h-4 mt-0.5 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">Google Air Quality Error</p>
                  <p className="text-xs text-red-700 mt-0.5">{googleError}</p>
                </div>
              </div>
            )}

            {googleAqData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(googleAqData.indexes || []).map((idxItem) => (
                    <div
                      key={idxItem.code}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs text-slate-500">
                          {idxItem.displayName} · {idxItem.code.toUpperCase()}
                        </div>
                        <div className="text-base font-semibold text-slate-900 mt-0.5">
                          {idxItem.category}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Dominant pollutant:{' '}
                          <span className="font-mono font-medium">
                            {idxItem.dominantPollutant || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                        {idxItem.aqiDisplay || idxItem.aqi}
                      </div>
                    </div>
                  ))}
                </div>

                {traceableRows.length > 0 && activeMode === 'google_aq' && (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                          <th className="py-2.5 px-3">Row ID</th>
                          <th className="py-2.5 px-3">Signal / Pollutant</th>
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Reading</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {traceableRows.map((row) => (
                          <tr
                            key={row.rowId}
                            className={
                              highlightedRowId === row.rowId
                                ? 'bg-blue-50'
                                : 'hover:bg-slate-50'
                            }
                          >
                            <td className="py-2 px-3 font-mono text-xs text-slate-600">
                              {row.rowId}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900">
                              {row.station}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-slate-600 tabular-nums">
                              {row.timestamp}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-slate-800">
                              {row.summary}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                <p className="text-sm font-medium text-slate-800">
                  Ready for coordinate lookup
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your Google Maps Air Quality API key and coordinates to
                  fetch local AQI, pollutant concentrations, and health guidance.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: UPLOAD / PASTE MESSY DATA */}
        {activeMode === 'messy' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileRead(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`p-6 border border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.txt,.tsv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileRead(file);
                    }}
                  />
                  <Upload
                    className="w-5 h-5 mx-auto text-slate-500 mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-slate-800">
                    Drop CSV, JSON, or TXT file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Or click to browse local sensor logs
                  </p>
                  {uploadedFileName && (
                    <p className="text-xs font-mono text-blue-700 mt-2">
                      Loaded file: {uploadedFileName}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleMessyTextUpdate(
                        SAMPLE_MESSY_TABLE_TEXT,
                        'messy_ward_sensors_sample.txt',
                      )
                    }
                    className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Load Messy Sample Table
                  </button>
                  {messyText && (
                    <button
                      type="button"
                      onClick={() => handleMessyTextUpdate('', undefined)}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Clear Input
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Supports mixed units (<span className="font-mono">µg/m³</span>{' '}
                  vs <span className="font-mono">mg/m³</span>), missing values (
                  <span className="font-mono">NA</span>,{' '}
                  <span className="font-mono">-</span>,{' '}
                  <span className="font-mono">null</span>), stale dates, and
                  outlier spikes.
                </p>
              </div>

              <div className="lg:col-span-7">
                <label
                  htmlFor="messy-paste-box"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Raw Sensor Table / CSV / JSON Paste Box
                </label>
                <textarea
                  id="messy-paste-box"
                  rows={8}
                  value={messyText}
                  onChange={(e) => handleMessyTextUpdate(e.target.value)}
                  placeholder="Paste raw ward sensor tables, CSV rows, or JSON logs..."
                  className="w-full p-3 text-xs font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {activeMode === 'messy' && traceableRows.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-medium text-slate-600">
                      <th className="py-2 px-3">Row ID</th>
                      <th className="py-2 px-3">Detected Station / Header</th>
                      <th className="py-2 px-3">Raw Line Excerpt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {traceableRows.map((r) => (
                      <tr
                        key={r.rowId}
                        className={
                          highlightedRowId === r.rowId
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {r.rowId}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {r.station}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 break-all">
                          {r.rawText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
