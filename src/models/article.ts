export type ArticleParagraph = {
  type: string;
  text: string;
};

export type ArticleSource = {
  source: string;
  contribution?: string;
};

export type ArticleCoverage = {
  evidence_id: string;
  url: string;
  title: string;
  source: string;
  language?: string | null;
  published_at?: string | null;
};

export type CanonicalArticle = {
  event_id: string;
  article_version_id: number | null;
  version_number: number | null;
  language: string;
  content_language?: string;
  requested_language?: string;
  translation_available?: boolean;
  translation_entitled?: boolean;
  translation_status?: "not_requested" | "pending" | "ready";
  experimental_localization?: boolean;
  authoritative_language?: string;
  authoritative_article_version_id?: number | null;
  localization_warning?: string | null;
  generation_status?:
    | "not_generated"
    | "processing"
    | "ready"
    | "failed"
    | "disabled"
    | "pro_required"
    | "source_only";
  generation_policy?:
    | "local_only"
    | "top_eligible"
    | "national_eligible"
    | "existing_canonical";
  canonical_stale?: boolean;
  latest_evidence_at?: string | null;
  stale_refresh_entitled?: boolean;
  status: string;
  slug: string;
  headline: string;
  standfirst: string;
  image_url?: string | null;
  video_url?: string | null;
  video_thumbnail_url?: string | null;
  category?: string | null;
  ranking_score?: number | null;
  article_count?: number | null;
  source_count?: number | null;
  source_url?: string | null;
  what_happened: string;
  why_it_matters: string;
  what_next: string;
  uncertainties: string[];
  body: ArticleParagraph[];
  sources_used: ArticleSource[];
  coverage?: ArticleCoverage[];
  generated_at: string | null;
  published_at: string | null;
  updated_at: string | null;
};

export type SavedArticleSnapshot = CanonicalArticle & {
  snapshot_id: string;
  saved_at: string;
};
