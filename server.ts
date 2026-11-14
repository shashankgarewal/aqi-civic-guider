import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '4mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const BRIEFING_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'cityOrArea',
    'overallAqi',
    'cpcbCategory',
    'grapStage',
    'dominantPollutant',
    'summaryHeadline',
    'executiveSummary',
    'normalizedStations',
    'dataGapsAndAnomalies',
    'hotspotFindings',
    'actionPlan',
    'internalBriefingNote',
    'citizenAdvisory',
  ],
  properties: {
    cityOrArea: { type: Type.STRING },
    overallAqi: { type: Type.NUMBER },
    cpcbCategory: {
      type: Type.STRING,
      enum: [
        'Good',
        'Satisfactory',
        'Moderate',
        'Poor [GRAP-I]',
        'Very Poor [GRAP-II]',
        'Severe [GRAP-III/IV]',
      ],
    },
    grapStage: { type: Type.STRING },
    dominantPollutant: { type: Type.STRING },
    summaryHeadline: { type: Type.STRING },
    executiveSummary: { type: Type.STRING },
    normalizedStations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'sourceRowId',
          'station',
          'timestamp',
          'dominantPollutant',
          'normalizedPollutantsSummary',
          'estimatedCpcbAqi',
          'cpcbCategory',
          'reliabilityStatus',
          'notes',
        ],
        properties: {
          sourceRowId: { type: Type.STRING },
          station: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          dominantPollutant: { type: Type.STRING },
          normalizedPollutantsSummary: { type: Type.STRING },
          estimatedCpcbAqi: { type: Type.NUMBER },
          cpcbCategory: {
            type: Type.STRING,
            enum: [
              'Good',
              'Satisfactory',
              'Moderate',
              'Poor [GRAP-I]',
              'Very Poor [GRAP-II]',
              'Severe [GRAP-III/IV]',
            ],
          },
          reliabilityStatus: {
            type: Type.STRING,
            enum: ['Verified', 'Partial', 'Flagged'],
          },
          notes: { type: Type.STRING },
        },
      },
    },
    dataGapsAndAnomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'sourceRowId',
          'station',
          'issueType',
          'rawValueExcerpt',
          'explanation',
          'impactOnBriefing',
        ],
        properties: {
          sourceRowId: { type: Type.STRING },
          station: { type: Type.STRING },
          issueType: {
            type: Type.STRING,
            enum: [
              'Missing Sensor',
              'Stale Timestamp',
              'Unit Anomaly',
              'Impossible Spike',
              'Malformed Row',
            ],
          },
          rawValueExcerpt: { type: Type.STRING },
          explanation: { type: Type.STRING },
          impactOnBriefing: { type: Type.STRING },
        },
      },
    },
    hotspotFindings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'title',
          'station',
          'aqiOrReading',
          'dominantPollutant',
          'likelyLocalSource',
          'plainLanguageSummary',
          'citations',
        ],
        properties: {
          title: { type: Type.STRING },
          station: { type: Type.STRING },
          aqiOrReading: { type: Type.STRING },
          dominantPollutant: { type: Type.STRING },
          likelyLocalSource: { type: Type.STRING },
          plainLanguageSummary: { type: Type.STRING },
          citations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
    actionPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'priority',
          'actionTitle',
          'operationalSteps',
          'triggeringEvidence',
          'sourceRowId',
          'dominantPollutantRationale',
        ],
        properties: {
          priority: {
            type: Type.STRING,
            enum: ['P1 Immediate', 'P2 Today', 'P3 Precautionary'],
          },
          actionTitle: { type: Type.STRING },
          operationalSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          triggeringEvidence: { type: Type.STRING },
          sourceRowId: { type: Type.STRING },
          dominantPollutantRationale: { type: Type.STRING },
        },
      },
    },
    internalBriefingNote: {
      type: Type.OBJECT,
      required: [
        'memoHeader',
        'situationOverview',
        'stationTraceabilitySummary',
        'sensorWarnings',
        'operationalDirectives',
      ],
      properties: {
        memoHeader: {
          type: Type.OBJECT,
          required: [
            'to',
            'from',
            'subject',
            'dateAndWindow',
            'severityClassification',
          ],
          properties: {
            to: { type: Type.STRING },
            from: { type: Type.STRING },
            subject: { type: Type.STRING },
            dateAndWindow: { type: Type.STRING },
            severityClassification: { type: Type.STRING },
          },
        },
        situationOverview: { type: Type.STRING },
        stationTraceabilitySummary: { type: Type.STRING },
        sensorWarnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        operationalDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
    citizenAdvisory: {
      type: Type.OBJECT,
      required: [
        'language',
        'readingLevel',
        'bulletinTitle',
        'whatsappShareText',
        'mainMessage',
        'callouts',
        'citations',
      ],
      properties: {
        language: { type: Type.STRING },
        readingLevel: { type: Type.STRING },
        bulletinTitle: { type: Type.STRING },
        whatsappShareText: { type: Type.STRING },
        mainMessage: { type: Type.STRING },
        callouts: {
          type: Type.OBJECT,
          required: ['children', 'olderAdults', 'sensitiveGroups'],
          properties: {
            children: { type: Type.STRING },
            olderAdults: { type: Type.STRING },
            sensitiveGroups: { type: Type.STRING },
          },
        },
        citations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  },
};

async function readUpstreamJson(
  upstream: Response,
  serviceName: string,
): Promise<{ ok: boolean; status: number; data: unknown; rawText: string }> {
  const rawText = await upstream.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: upstream.ok,
      status: upstream.status,
      data: {},
      rawText: '',
    };
  }
  if (trimmed.startsWith('<')) {
    throw new Error(
      `${serviceName} returned an HTML page (HTTP ${upstream.status}) instead of JSON.`,
    );
  }
  try {
    return {
      ok: upstream.ok,
      status: upstream.status,
      data: JSON.parse(trimmed),
      rawText: trimmed,
    };
  } catch {
    throw new Error(
      `${serviceName} returned non-JSON content (HTTP ${upstream.status}): ${trimmed.slice(0, 140)}`,
    );
  }
}

app.post('/api/cpcb/fetch', async (req, res) => {
  try {
    const apiKey = String(req.body?.apiKey || '').trim();
    const city = String(req.body?.city || '').trim();

    if (!apiKey) {
      res.status(400).json({ error: 'CPCB data.gov.in API key is required.' });
      return;
    }
    if (!city) {
      res.status(400).json({ error: 'City name is required.' });
      return;
    }

    const url = new URL(
      'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69',
    );
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '500');
    url.searchParams.set('filters[city]', city);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AQI-Civic-Guider/1.0',
      },
    }).finally(() => clearTimeout(timer));

    const parsed = await readUpstreamJson(upstream, 'CPCB data.gov.in API');

    if (!parsed.ok) {
      const errData = parsed.data as { message?: string; error?: string };
      res.status(parsed.status).json({
        error: `CPCB API returned HTTP ${parsed.status}: ${errData.message || errData.error || parsed.rawText.slice(0, 200)}`,
      });
      return;
    }

    const payload = parsed.data as {
      records?: unknown[];
      message?: string;
      status?: string;
    };

    if (!Array.isArray(payload.records)) {
      res.status(502).json({
        error:
          payload.message ||
          'Unexpected response format from data.gov.in CPCB feed.',
      });
      return;
    }

    res.json({
      records: payload.records,
      count: payload.records.length,
      city,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch CPCB feed.';
    res.status(502).json({
      error: `Live CPCB feed unavailable (${message}). Verify the API key, city spelling, or network connectivity.`,
    });
  }
});

app.post('/api/google-aq/fetch', async (req, res) => {
  try {
    const apiKey = String(req.body?.apiKey || '').trim();
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!apiKey) {
      res
        .status(400)
        .json({ error: 'Google Maps Air Quality API key is required.' });
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res
        .status(400)
        .json({ error: 'Valid numeric latitude and longitude are required.' });
      return;
    }

    const endpoint = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude, longitude },
        extraComputations: [
          'HEALTH_RECOMMENDATIONS',
          'DOMINANT_POLLUTANT_CONCENTRATION',
          'LOCAL_AQI',
        ],
      }),
    }).finally(() => clearTimeout(timer));

    const parsed = await readUpstreamJson(
      upstream,
      'Google Air Quality API',
    );
    if (!parsed.ok) {
      const errMsg =
        (parsed.data as { error?: { message?: string } })?.error?.message ||
        `Google Air Quality API returned HTTP ${parsed.status}`;
      res.status(parsed.status).json({ error: errMsg });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to reach Google Air Quality API.';
    res.status(502).json({ error: message });
  }
});

async function generateWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [800, 1800];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isRetryable || attempt === delays.length) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  throw lastErr;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const {
      traceableRows,
      sourceMode,
      cityOrArea,
      persona,
      language,
      readingLevel,
    } = req.body ?? {};

    if (!Array.isArray(traceableRows) || traceableRows.length === 0) {
      res.status(400).json({
        error: 'Please load or paste air quality data before generating a briefing.',
      });
      return;
    }

    const ai = getGeminiClient();

    const formattedRows = traceableRows
      .map(
        (r: {
          rowId: string;
          station: string;
          timestamp: string;
          summary: string;
          rawText: string;
        }) =>
          `[${r.rowId}] Station="${r.station}" | Time="${r.timestamp}" | Summary="${r.summary}" | Raw=${r.rawText}`,
      )
      .join('\n');

    const systemInstruction = `You are the AQI Civic Guider analytical engine.
Your job is to transform raw, potentially messy or multi-station air quality telemetry into an audited, evidence-backed civic operational briefing and multilingual citizen advisory.

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. NEVER invent stations, pollutant readings, timestamps, or city facts not present in the provided rows.
2. Every finding, normalized station row, data gap, and persona action MUST cite the exact input row ID (e.g., "ROW-01", "ROW-04") from the input table.
3. In hotspotFindings.plainLanguageSummary, include inline citations formatted like [ROW-01] or [Anand Vihar · ROW-02] directly in the prose, AND list the cited row IDs in the citations array.
4. Normalize mixed units accurately:
   - Convert mg/m³ particulate readings to µg/m³ (1 mg/m³ = 1000 µg/m³; e.g., 0.218 mg/m³ = 218 µg/m³). Keep CO in mg/m³ or clearly note unit conversion.
   - Compute or extract the Indian CPCB AQI category strictly using these tiers:
     * 0–50: "Good"
     * 51–100: "Satisfactory"
     * 101–200: "Moderate"
     * 201–300: "Poor [GRAP-I]"
     * 301–400: "Very Poor [GRAP-II]"
     * 401+: "Severe [GRAP-III/IV]"
5. Flag all Data Gaps & Unreliable Readings explicitly:
   - Missing values ("NA", "-", "null", blank)
   - Stale timestamps (more than 12 hours older than the active batch or days old)
   - Unit anomalies (mixed mg/m³ vs µg/m³)
   - Impossible spikes or sensor faults (e.g., negative values like -14, or extreme spikes like 9850 µg/m³) -> EXCLUDE impossible spikes from overall city AQI averages and explicitly state that in impactOnBriefing!
6. Tailor the 4 to 6 prioritized actions strictly to the Target Persona (${persona}):
   - "Ward Officer": Municipal enforcement, mechanized road sweeping & water sprinkling, C&D dust bans, traffic rerouting at choke points, anti-waste-burning drives.
   - "Housing Society / RWA": Common-area HEPA purifiers, wet mopping vs dry sweeping, halting internal flat civil/renovation work, DG set acoustic/emission rules, designating clean-air community rooms.
   - "School Administrator": Canceling outdoor PE/morning assemblies, classroom window-sealing and HEPA purifier protocols, nurse/inhaler readiness, shifting vulnerable grades or high-AQI days to hybrid/online classes.
   - "Hospital / Clinic Chief": Respiratory triage readiness, OPD surge alerts, ICU/ward air filtration & positive-pressure checks, nebulizer/oxygen stock verification, ambulance staging near hotspot corridors.
   - "Construction Site Manager": Anti-smog gun deployment schedules, green-net shrouding, tarpaulin material covering, wet suppression on haul roads, excavation/demolition halts under GRAP triggers.
   - "Transit & Traffic Police": Signal synchronization to cut idling, heavy diesel vehicle diversion, PUCC/visible-smoke & idle-engine checks, outdoor traffic personnel N95/shift rotation & commuter advisories.
   - Custom Persona / Role: If Target Persona is a custom role or description, tailor every action item, operational step, and Internal Briefing Note memo strictly to that role's real-world levers, facility scope, and operational authority.
7. Citizen Advisory Language & Reading Level:
   - Write the entire citizenAdvisory (bulletinTitle, whatsappShareText, mainMessage, callouts.children, callouts.olderAdults, callouts.sensitiveGroups) in the requested language: ${language}.
   - If the language is Hindi, Marathi, Bengali, or Tamil, write natural, authentic civic public-health prose in that script (Devanagari for Hindi/Marathi, Bengali script for Bengali, Tamil script for Tamil).
   - Respect the Reading Level:
     * "Simple / Grade 5 (Easy-to-read community poster)": Short sentences, everyday words, clear Do/Don't bullets, zero technical jargon.
     * "Standard Public Notice": Clear civic bulletin tone suitable for municipal or institutional circulars.`;

    const prompt = `Analyze the following ingested air quality records and produce the structured briefing JSON.

Configuration:
- Source Mode: ${sourceMode}
- City / Area Context: ${cityOrArea || 'Detected from input rows'}
- Target Persona: ${persona}
- Citizen Advisory Language: ${language}
- Citizen Reading Level: ${readingLevel}

Traceable Raw Input Rows:
${formattedRows}

Requirements checklist:
- Return 4 to 6 items in actionPlan prioritized across P1 Immediate, P2 Today, P3 Precautionary.
- Ensure every sourceRowId matches one of the [ROW-XX] IDs above.
- Format whatsappShareText cleanly for WhatsApp/notice boards (concise line breaks, clear protective advice, no fabricated numbers).`;

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: BRIEFING_RESPONSE_SCHEMA,
        },
      }),
    );

    const rawJson = (response.text ?? '').trim();
    if (!rawJson) {
      res
        .status(502)
        .json({ error: 'Gemini returned an empty response. Please try again.' });
      return;
    }

    const parsed = JSON.parse(rawJson);
    res.json({ briefing: parsed });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate AI briefing.';
    console.error('[api/analyze error]', message);
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AQI Civic Guider server listening on http://0.0.0.0:${PORT}`,
    );
  });
}

startServer();
