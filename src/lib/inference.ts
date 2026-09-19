/**
 * Inference seam between the API and the AI component.
 *
 * When INFERENCE_URL is set, assessments are POSTed to the external model
 * server (the Random Forest service built by the ML engineer). When it is
 * unset, or the service fails, the built-in rule engine is used instead so
 * the facility keeps working. Every response is normalized to `InferenceOutput`
 * so the rest of the backend never cares which engine produced it.
 *
 * ---- Contract with the external service ---------------------------------
 *
 * POST {INFERENCE_URL}
 * Headers: Content-Type: application/json
 *          Authorization: Bearer {INFERENCE_API_KEY}   (only if configured)
 * Body:    InferenceRequest (below)
 *
 * 200 response body: InferenceResponse (below). Field names are snake_case.
 *   urgency_score           1 (immediate) … 5 (non-urgent)           required
 *   triage_level            'immediate' | 'emergent' | 'urgent' |
 *                           'less_urgent' | 'non_urgent'             optional (derived from score if absent)
 *   confidence              0 … 1                                    optional
 *   reasoning               human-readable explanation               required
 *   suggested_tests         string[]                                 optional
 *   differential_diagnosis  [{ condition, probability (0…1), rationale }]  optional
 * ---------------------------------------------------------------------------
 */

import { evaluateTriage, TriageOutput } from '@/lib/triage-engine';

export const TRIAGE_LEVELS = ['immediate', 'emergent', 'urgent', 'less_urgent', 'non_urgent'] as const;
export type TriageLevel = (typeof TRIAGE_LEVELS)[number];

export interface InferenceRequest {
  patient: {
    age: number | null;
    sex: string | null;
    blood_type?: string | null;
    chronic_conditions?: string | null;
    allergies?: string | null;
  };
  visit_type: string;
  chief_complaint: string;
  symptoms: Array<{
    symptom_id: number;
    name: string;
    category?: string;
    severity: string; // mild | moderate | severe
    duration: string;
    notes?: string | null;
  }>;
  vitals: {
    temperature: number | null;
    blood_pressure: string | null;
    heart_rate: number | null;
    oxygen_level: number | null;
    respiratory_rate: number | null;
  };
}

export interface InferenceResponse {
  urgency_score: number;
  triage_level?: string;
  confidence?: number;
  reasoning: string;
  suggested_tests?: string[];
  differential_diagnosis?: Array<{ condition: string; probability: number; rationale?: string }>;
}

export interface InferenceOutput {
  urgencyScore: number;
  triageLevel: TriageLevel;
  confidence: number | null;
  reasoning: string;
  suggestedTests: string[];
  differentialDiagnosis: Array<{ condition: string; probability: number; rationale: string }>;
  /** Which engine produced the result — stored nowhere, but returned to the client and logged. */
  engine: 'external' | 'rules';
}

export function levelFromScore(score: number): TriageLevel {
  return TRIAGE_LEVELS[Math.min(5, Math.max(1, Math.round(score))) - 1];
}

export function isTriageLevel(v: unknown): v is TriageLevel {
  return typeof v === 'string' && (TRIAGE_LEVELS as readonly string[]).includes(v);
}

export async function runInference(input: InferenceRequest): Promise<InferenceOutput> {
  const url = process.env.INFERENCE_URL;
  if (url) {
    try {
      return await callExternal(url, input);
    } catch (err) {
      console.error(`[inference] external service failed, falling back to rules: ${(err as Error).message}`);
    }
  }
  return fromRules(input);
}

async function callExternal(url: string, input: InferenceRequest): Promise<InferenceOutput> {
  const timeoutMs = Number(process.env.INFERENCE_TIMEOUT_MS ?? 5000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.INFERENCE_API_KEY) headers.Authorization = `Bearer ${process.env.INFERENCE_API_KEY}`;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as InferenceResponse;
    return normalizeExternal(body);
  } finally {
    clearTimeout(timer);
  }
}

/** Validate the external response strictly — a bad model reply must never produce a bad record. */
export function normalizeExternal(body: InferenceResponse): InferenceOutput {
  const score = Number(body?.urgency_score);
  if (!Number.isFinite(score) || score < 1 || score > 5) throw new Error('urgency_score must be 1–5');
  if (typeof body.reasoning !== 'string' || !body.reasoning.trim()) throw new Error('reasoning is required');

  const triageLevel = isTriageLevel(body.triage_level) ? body.triage_level : levelFromScore(score);
  const confidence =
    typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : null;

  const suggestedTests = Array.isArray(body.suggested_tests)
    ? body.suggested_tests.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];

  const differentialDiagnosis = Array.isArray(body.differential_diagnosis)
    ? body.differential_diagnosis
        .filter((d) => d && typeof d.condition === 'string' && Number.isFinite(Number(d.probability)))
        .map((d) => ({
          condition: d.condition,
          probability: clamp01(Number(d.probability) > 1 ? Number(d.probability) / 100 : Number(d.probability)),
          rationale: typeof d.rationale === 'string' ? d.rationale : '',
        }))
        .sort((a, b) => b.probability - a.probability)
    : [];

  return {
    urgencyScore: Math.round(score),
    triageLevel,
    confidence,
    reasoning: body.reasoning.trim(),
    suggestedTests,
    differentialDiagnosis,
    engine: 'external',
  };
}

function fromRules(input: InferenceRequest): InferenceOutput {
  const out: TriageOutput = evaluateTriage({
    age: input.patient.age ?? undefined,
    gender: input.patient.sex ?? undefined,
    chiefComplaint: input.chief_complaint,
    symptoms: input.symptoms.map((s) => ({ name: s.name, severity: s.severity, duration: s.duration })),
    vitals: {
      temperature: input.vitals.temperature,
      bloodPressure: input.vitals.blood_pressure,
      heartRate: input.vitals.heart_rate,
      oxygenLevel: input.vitals.oxygen_level,
      respiratoryRate: input.vitals.respiratory_rate,
    },
  });
  return {
    urgencyScore: out.urgencyScore,
    triageLevel: out.triageLevel,
    confidence: null,
    reasoning: out.reasoning,
    suggestedTests: out.suggestedTests,
    differentialDiagnosis: out.differentialDiagnosis,
    engine: 'rules',
  };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
