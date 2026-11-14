import type {
  ActionPriority,
  CpcbCategory,
  CpcbRawRecord,
  GoogleAqResponse,
  GroupedCpcbStation,
  SavedBriefRecord,
  TraceableCpcbRow,
  TraceableInputRow,
} from '../types/airQuality';

export interface CpcbStyleMeta {
  category: CpcbCategory;
  rangeLabel: string;
  grapLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentHex: string;
}

export function getCpcbCategoryFromAqi(aqi: number): CpcbCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor [GRAP-I]';
  if (aqi <= 400) return 'Very Poor [GRAP-II]';
  return 'Severe [GRAP-III/IV]';
}

export function getCpcbStyle(categoryOrAqi: CpcbCategory | number): CpcbStyleMeta {
  const category =
    typeof categoryOrAqi === 'number'
      ? getCpcbCategoryFromAqi(categoryOrAqi)
      : categoryOrAqi;

  switch (category) {
    case 'Good':
      return {
        category: 'Good',
        rangeLabel: '0–50',
        grapLabel: 'Baseline',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-800',
        badgeBorder: 'border-emerald-200',
        accentHex: '#15803D',
      };
    case 'Satisfactory':
      return {
        category: 'Satisfactory',
        rangeLabel: '51–100',
        grapLabel: 'Baseline',
        badgeBg: 'bg-lime-50',
        badgeText: 'text-lime-800',
        badgeBorder: 'border-lime-200',
        accentHex: '#4D7C0F',
      };
    case 'Moderate':
      return {
        category: 'Moderate',
        rangeLabel: '101–200',
        grapLabel: 'Advisory Watch',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-200',
        accentHex: '#B45309',
      };
    case 'Poor [GRAP-I]':
      return {
        category: 'Poor [GRAP-I]',
        rangeLabel: '201–300',
        grapLabel: 'GRAP Stage I',
        badgeBg: 'bg-orange-50',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-200',
        accentHex: '#C2410C',
      };
    case 'Very Poor [GRAP-II]':
      return {
        category: 'Very Poor [GRAP-II]',
        rangeLabel: '301–400',
        grapLabel: 'GRAP Stage II',
        badgeBg: 'bg-red-50',
        badgeText: 'text-red-800',
        badgeBorder: 'border-red-200',
        accentHex: '#B91C1C',
      };
    case 'Severe [GRAP-III/IV]':
    default:
      return {
        category: 'Severe [GRAP-III/IV]',
        rangeLabel: '401+',
        grapLabel: 'GRAP Stage III/IV',
        badgeBg: 'bg-rose-950',
        badgeText: 'text-rose-50',
        badgeBorder: 'border-rose-900',
        accentHex: '#881337',
      };
  }
}

function pickField(
  raw: Record<string, unknown>,
  keys: string[],
): string | number | null {
  for (const k of keys) {
    const val = raw[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val as string | number;
    }
  }
  return null;
}

export function isNumericReading(val: string | number | null | undefined): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (!s || s.toUpperCase() === 'NA' || s === '-' || s.toLowerCase() === 'null') {
    return false;
  }
  return Number.isFinite(Number(s));
}

export function groupCpcbRecords(records: CpcbRawRecord[]): {
  grouped: Array<GroupedCpcbStation & { validReadingCount: number }>;
  traceableRows: TraceableInputRow[];
  validRowCount: number;
} {
  const map = new Map<string, GroupedCpcbStation & { validReadingCount: number }>();
  const traceableRows: TraceableInputRow[] = [];
  let validRowCount = 0;

  records.forEach((rec, idx) => {
    const raw = rec as unknown as Record<string, unknown>;
    const station = String(
      pickField(raw, ['station', 'station_name', 'Station']) ?? 'Unknown Station',
    );
    const city = String(pickField(raw, ['city', 'City']) ?? 'Unknown City');
    const state = pickField(raw, ['state', 'State']);
    const lastUpdate = String(
      pickField(raw, ['last_update', 'last_updated', 'updated_at']) ??
        'Unknown Timestamp',
    );
    const pollutantId = String(
      pickField(raw, ['pollutant_id', 'pollutant', 'Pollutant_ID']) ?? 'UNKNOWN',
    );
    const pollutantMin = pickField(raw, [
      'pollutant_min',
      'min_value',
      'min',
      'Pollutant_Min',
    ]);
    const pollutantMax = pickField(raw, [
      'pollutant_max',
      'max_value',
      'max',
      'Pollutant_Max',
    ]);
    const pollutantAvg = pickField(raw, [
      'pollutant_avg',
      'avg_value',
      'avg',
      'Pollutant_Avg',
    ]);

    const normalizedRec: CpcbRawRecord = {
      ...rec,
      station,
      city,
      state: state ? String(state) : undefined,
      last_update: lastUpdate,
      pollutant_id: pollutantId,
      pollutant_min: pollutantMin ?? 'NA',
      pollutant_max: pollutantMax ?? 'NA',
      pollutant_avg: pollutantAvg ?? 'NA',
    };

    const rowId = `ROW-${String(idx + 1).padStart(2, '0')}`;
    const traceableRec: TraceableCpcbRow = { ...normalizedRec, rowId };
    const key = `${station}__${lastUpdate}`;

    if (!map.has(key)) {
      map.set(key, {
        station,
        city,
        state: state ? String(state) : undefined,
        lastUpdate,
        stationRowId: rowId,
        readings: [],
        validReadingCount: 0,
      });
    }

    const groupEntry = map.get(key)!;
    groupEntry.readings.push(traceableRec);

    const hasNumeric =
      isNumericReading(pollutantAvg) ||
      isNumericReading(pollutantMin) ||
      isNumericReading(pollutantMax);
    if (hasNumeric) {
      groupEntry.validReadingCount += 1;
      validRowCount += 1;
    }

    traceableRows.push({
      rowId,
      sourceMode: 'cpcb',
      station,
      timestamp: lastUpdate,
      summary: `${pollutantId}: avg=${pollutantAvg ?? 'NA'} (min=${pollutantMin ?? 'NA'}, max=${pollutantMax ?? 'NA'})`,
      rawText: JSON.stringify(rec),
    });
  });

  const grouped = Array.from(map.values()).sort(
    (a, b) => b.validReadingCount - a.validReadingCount,
  );

  return {
    grouped,
    traceableRows,
    validRowCount,
  };
}

export function buildTraceableRowsFromGoogleAq(
  data: GoogleAqResponse,
  lat: number,
  lng: number,
): TraceableInputRow[] {
  const rows: TraceableInputRow[] = [];
  const locationLabel = `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)} (${data.regionCode || 'IN'})`;

  (data.indexes ?? []).forEach((idxItem, i) => {
    rows.push({
      rowId: `ROW-${String(rows.length + 1).padStart(2, '0')}`,
      sourceMode: 'google_aq',
      station: `${locationLabel} · Index ${idxItem.displayName}`,
      timestamp: data.dateTime || 'Current',
      summary: `AQI ${idxItem.aqiDisplay || idxItem.aqi} (${idxItem.category}) · Dominant: ${idxItem.dominantPollutant || 'N/A'}`,
      rawText: JSON.stringify({ indexPosition: i + 1, ...idxItem }),
    });
  });

  (data.pollutants ?? []).forEach((pol) => {
    rows.push({
      rowId: `ROW-${String(rows.length + 1).padStart(2, '0')}`,
      sourceMode: 'google_aq',
      station: `${locationLabel} · ${pol.displayName}`,
      timestamp: data.dateTime || 'Current',
      summary: `${pol.displayName}: ${pol.concentration.value} ${pol.concentration.units}`,
      rawText: JSON.stringify(pol),
    });
  });

  if (data.healthRecommendations) {
    rows.push({
      rowId: `ROW-${String(rows.length + 1).padStart(2, '0')}`,
      sourceMode: 'google_aq',
      station: `${locationLabel} · Official Health Guidance`,
      timestamp: data.dateTime || 'Current',
      summary: data.healthRecommendations.generalPopulation || 'Health guidance present',
      rawText: JSON.stringify(data.healthRecommendations),
    });
  }

  return rows;
}

export function buildTraceableRowsFromMessyText(rawText: string): TraceableInputRow[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Check if JSON array/object
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((item, idx) => {
        const station =
          item.station ||
          item.ward ||
          item.location ||
          item.sensor_id ||
          `Record ${idx + 1}`;
        const timestamp =
          item.timestamp || item.last_update || item.date || item.time || 'Unspecified';
        return {
          rowId: `ROW-${String(idx + 1).padStart(2, '0')}`,
          sourceMode: 'messy' as const,
          station: String(station),
          timestamp: String(timestamp),
          summary: JSON.stringify(item).slice(0, 140),
          rawText: JSON.stringify(item),
        };
      });
    } catch {
      // Fall through to line-by-line parsing
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  return lines.map((line, idx) => {
    const rowId = `ROW-${String(idx + 1).padStart(2, '0')}`;
    const parts = line.split(/[,\t|;]+/).map((p) => p.trim());
    const stationGuess = parts[0] || `Line ${idx + 1}`;
    const timeGuess =
      parts.find((p) => /\d{4}|\d{1,2}[:/]\d{1,2}|ago|IST|AM|PM/i.test(p)) ||
      'See raw row';

    return {
      rowId,
      sourceMode: 'messy',
      station: stationGuess.slice(0, 48),
      timestamp: timeGuess.slice(0, 32),
      summary: line.slice(0, 140),
      rawText: line,
    };
  });
}

export interface StationDelta {
  station: string;
  previousAqi: number | null;
  currentAqi: number;
  delta: number | null;
  direction: 'worsened' | 'improved' | 'unchanged' | 'new';
  dominantPollutant: string;
}

export interface BriefDeltaComparison {
  overallDelta: number;
  direction: 'worsened' | 'improved' | 'unchanged';
  previousAqi: number;
  currentAqi: number;
  previousCategory: CpcbCategory;
  currentCategory: CpcbCategory;
  stationDeltas: StationDelta[];
  newlyEscalatedActions: Array<{ priority: ActionPriority; actionTitle: string }>;
  deEscalatedActions: Array<{ priority: ActionPriority; actionTitle: string }>;
  retainedActions: Array<{ priority: ActionPriority; actionTitle: string }>;
}

const PRIORITY_RANK: Record<ActionPriority, number> = {
  'P1 Immediate': 3,
  'P2 Today': 2,
  'P3 Precautionary': 1,
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function computeBriefDelta(
  current: SavedBriefRecord,
  previous: SavedBriefRecord,
): BriefDeltaComparison {
  const overallDelta = current.overallAqi - previous.overallAqi;
  const direction =
    overallDelta > 0 ? 'worsened' : overallDelta < 0 ? 'improved' : 'unchanged';

  const prevStationMap = new Map<string, number>();
  previous.stationAqis.forEach((s) => {
    prevStationMap.set(normalizeKey(s.station), s.aqi);
  });

  const stationDeltas: StationDelta[] = current.stationAqis.map((currStation) => {
    const key = normalizeKey(currStation.station);
    let prevAqi = prevStationMap.get(key) ?? null;

    if (prevAqi === null) {
      for (const [prevKey, val] of prevStationMap.entries()) {
        if (prevKey.includes(key) || key.includes(prevKey)) {
          prevAqi = val;
          break;
        }
      }
    }

    if (prevAqi === null) {
      return {
        station: currStation.station,
        previousAqi: null,
        currentAqi: currStation.aqi,
        delta: null,
        direction: 'new',
        dominantPollutant: currStation.dominantPollutant,
      };
    }

    const delta = currStation.aqi - prevAqi;
    return {
      station: currStation.station,
      previousAqi: prevAqi,
      currentAqi: currStation.aqi,
      delta,
      direction: delta > 0 ? 'worsened' : delta < 0 ? 'improved' : 'unchanged',
      dominantPollutant: currStation.dominantPollutant,
    };
  });

  const prevActionMap = new Map<string, ActionPriority>();
  previous.actions.forEach((a) => {
    prevActionMap.set(normalizeKey(a.actionTitle), a.priority);
  });

  const currActionMap = new Map<string, ActionPriority>();
  current.actions.forEach((a) => {
    currActionMap.set(normalizeKey(a.actionTitle), a.priority);
  });

  const newlyEscalatedActions: Array<{ priority: ActionPriority; actionTitle: string }> = [];
  const retainedActions: Array<{ priority: ActionPriority; actionTitle: string }> = [];

  current.actions.forEach((currAct) => {
    const key = normalizeKey(currAct.actionTitle);
    const prevPri = prevActionMap.get(key);
    if (!prevPri) {
      if (currAct.priority === 'P1 Immediate' || overallDelta > 0) {
        newlyEscalatedActions.push(currAct);
      } else {
        retainedActions.push(currAct);
      }
    } else if (PRIORITY_RANK[currAct.priority] > PRIORITY_RANK[prevPri]) {
      newlyEscalatedActions.push(currAct);
    } else {
      retainedActions.push(currAct);
    }
  });

  const deEscalatedActions: Array<{ priority: ActionPriority; actionTitle: string }> = [];
  previous.actions.forEach((prevAct) => {
    const key = normalizeKey(prevAct.actionTitle);
    const currPri = currActionMap.get(key);
    if (!currPri && (prevAct.priority === 'P1 Immediate' || overallDelta < 0)) {
      deEscalatedActions.push(prevAct);
    } else if (currPri && PRIORITY_RANK[currPri] < PRIORITY_RANK[prevAct.priority]) {
      deEscalatedActions.push(prevAct);
    }
  });

  return {
    overallDelta,
    direction,
    previousAqi: previous.overallAqi,
    currentAqi: current.overallAqi,
    previousCategory: previous.cpcbCategory,
    currentCategory: current.cpcbCategory,
    stationDeltas,
    newlyEscalatedActions,
    deEscalatedActions,
    retainedActions,
  };
}
