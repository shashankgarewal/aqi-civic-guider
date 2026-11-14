export type IngestionMode = 'cpcb' | 'google_aq' | 'messy';

export type BuiltInPersona =
  | 'Ward Officer'
  | 'Housing Society / RWA'
  | 'School Administrator'
  | 'Hospital / Clinic Chief'
  | 'Construction Site Manager'
  | 'Transit & Traffic Police';

export type TargetPersona = string;

export type AdvisoryLanguage =
  | 'English'
  | 'Hindi'
  | 'Marathi'
  | 'Bengali'
  | 'Tamil';

export type ReadingLevel =
  | 'Simple / Grade 5 (Easy-to-read community poster)'
  | 'Standard Public Notice';

export type CpcbCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor [GRAP-I]'
  | 'Very Poor [GRAP-II]'
  | 'Severe [GRAP-III/IV]';

export interface CpcbRawRecord {
  country?: string;
  state?: string;
  city: string;
  station: string;
  last_update: string;
  latitude?: string;
  longitude?: string;
  pollutant_id: string;
  pollutant_min: string | number | null;
  pollutant_max: string | number | null;
  pollutant_avg: string | number | null;
}

export interface TraceableCpcbRow extends CpcbRawRecord {
  rowId: string;
}

export interface GroupedCpcbStation {
  station: string;
  city: string;
  state?: string;
  lastUpdate: string;
  stationRowId: string;
  readings: TraceableCpcbRow[];
}

export interface GoogleAqIndex {
  code: string;
  displayName: string;
  aqi: number;
  aqiDisplay: string;
  color?: { red?: number; green?: number; blue?: number };
  category: string;
  dominantPollutant?: string;
}

export interface GoogleAqPollutant {
  code: string;
  displayName: string;
  fullName?: string;
  concentration: {
    value: number;
    units: string;
  };
  additionalInfo?: {
    sources?: string;
    effects?: string;
  };
}

export interface GoogleAqResponse {
  dateTime: string;
  regionCode: string;
  indexes?: GoogleAqIndex[];
  pollutants?: GoogleAqPollutant[];
  healthRecommendations?: {
    generalPopulation?: string;
    elderly?: string;
    lungDiseasePopulation?: string;
    heartDiseasePopulation?: string;
    athletes?: string;
    pregnantWomen?: string;
    children?: string;
  };
}

export interface TraceableInputRow {
  rowId: string;
  sourceMode: IngestionMode;
  station: string;
  timestamp: string;
  summary: string;
  rawText: string;
}

export interface NormalizedStationRow {
  sourceRowId: string;
  station: string;
  timestamp: string;
  dominantPollutant: string;
  normalizedPollutantsSummary: string;
  estimatedCpcbAqi: number;
  cpcbCategory: CpcbCategory;
  reliabilityStatus: 'Verified' | 'Partial' | 'Flagged';
  notes: string;
}

export interface DataGapAnomaly {
  sourceRowId: string;
  station: string;
  issueType:
    | 'Missing Sensor'
    | 'Stale Timestamp'
    | 'Unit Anomaly'
    | 'Impossible Spike'
    | 'Malformed Row';
  rawValueExcerpt: string;
  explanation: string;
  impactOnBriefing: string;
}

export interface HotspotFinding {
  title: string;
  station: string;
  aqiOrReading: string;
  dominantPollutant: string;
  likelyLocalSource: string;
  plainLanguageSummary: string;
  citations: string[];
}

export type ActionPriority = 'P1 Immediate' | 'P2 Today' | 'P3 Precautionary';

export interface PersonaActionItem {
  priority: ActionPriority;
  actionTitle: string;
  operationalSteps: string[];
  triggeringEvidence: string;
  sourceRowId: string;
  dominantPollutantRationale: string;
}

export interface InternalBriefingNote {
  memoHeader: {
    to: string;
    from: string;
    subject: string;
    dateAndWindow: string;
    severityClassification: string;
  };
  situationOverview: string;
  stationTraceabilitySummary: string;
  sensorWarnings: string[];
  operationalDirectives: string[];
}

export interface CitizenAdvisory {
  language: AdvisoryLanguage;
  readingLevel: ReadingLevel;
  bulletinTitle: string;
  whatsappShareText: string;
  mainMessage: string;
  callouts: {
    children: string;
    olderAdults: string;
    sensitiveGroups: string;
  };
  citations: string[];
}

export interface AirQualityBriefingResult {
  cityOrArea: string;
  overallAqi: number;
  cpcbCategory: CpcbCategory;
  grapStage: string;
  dominantPollutant: string;
  summaryHeadline: string;
  executiveSummary: string;
  normalizedStations: NormalizedStationRow[];
  dataGapsAndAnomalies: DataGapAnomaly[];
  hotspotFindings: HotspotFinding[];
  actionPlan: PersonaActionItem[];
  internalBriefingNote: InternalBriefingNote;
  citizenAdvisory: CitizenAdvisory;
}

export interface SavedBriefRecord {
  id: string;
  createdAt: string;
  cityOrWard: string;
  sourceMode: IngestionMode;
  persona: TargetPersona;
  language: AdvisoryLanguage;
  readingLevel: ReadingLevel;
  overallAqi: number;
  cpcbCategory: CpcbCategory;
  grapStage: string;
  dominantPollutant: string;
  stationAqis: Array<{
    station: string;
    aqi: number;
    dominantPollutant: string;
    sourceRowId: string;
  }>;
  actions: Array<{
    priority: ActionPriority;
    actionTitle: string;
  }>;
  result: AirQualityBriefingResult;
}
