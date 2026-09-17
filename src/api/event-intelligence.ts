const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

export type EventClaimObservation = {
  claim_id: string;
  evidence_id: string;
  source: string;
  source_language: string;
  text: string;
  signature: string;
  numbers: string[];
  negated: boolean;
};

export type EventContradictionCandidate = {
  contradiction_id: string;
  signature: string;
  evidence_ids: string[];
  sources: string[];
  reason: "negation_conflict" | "numeric_conflict" | string;
  severity: "medium" | "high" | string;
  observations: EventClaimObservation[];
};

export type EventCorroboration = {
  unique_evidence_count?: number;
  unique_source_count?: number;
  language_count?: number;
  country_count?: number;
};

export type EventAssessment = {
  confidence_state?: "single_source" | "developing" | "corroborated" | "conflicted" | string;
  confidence_score?: number;
  confidence_reasons?: string[];
  is_conflicted?: boolean;
  contradiction_count?: number;
  contradictions?: EventContradictionCandidate[];
  claim_observations?: EventClaimObservation[];
  corroboration?: EventCorroboration;
};

export type EventEvidence = {
  evidence_id: string;
  title?: string | null;
  summary?: string | null;
  source?: string | null;
  source_language?: string | null;
  country?: string | null;
  original_url?: string | null;
  canonical_url?: string | null;
  published_at?: string | null;
  is_duplicate?: boolean;
};

export type EventIntelligence = {
  event_id: string;
  title?: string | null;
  article_count?: number | null;
  last_updated_at?: string | null;
  assessment?: EventAssessment | null;
  evidence?: EventEvidence[];
};

function requireApiBaseUrl() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  return API_BASE_URL;
}

export async function getEventIntelligence(
  eventId: string,
  evidenceLimit = 30,
): Promise<EventIntelligence> {
  const params = new URLSearchParams({
    evidence_limit: String(Math.max(1, Math.min(evidenceLimit, 100))),
  });
  const response = await fetch(
    `${requireApiBaseUrl()}/api/events/${encodeURIComponent(eventId)}/intelligence?${params.toString()}`,
  );
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly event intelligence request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<EventIntelligence>;
}
