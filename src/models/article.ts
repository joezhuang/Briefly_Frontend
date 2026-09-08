export type ArticleParagraph = {
  type: string;
  text: string;
};

export type ArticleSource = {
  source: string;
  contribution?: string;
};

export type CanonicalArticle = {
  event_id: string;
  article_version_id: number;
  version_number: number;
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
  status: string;
  slug: string;
  headline: string;
  standfirst: string;
  image_url?: string | null;
  category?: string | null;
  ranking_score?: number | null;
  source_count?: number | null;
  what_happened: string;
  why_it_matters: string;
  what_next: string;
  uncertainties: string[];
  body: ArticleParagraph[];
  sources_used: ArticleSource[];
  generated_at: string | null;
  published_at: string | null;
  updated_at: string | null;
};

export type SavedArticleSnapshot = CanonicalArticle & {
  snapshot_id: string;
  saved_at: string;
};
