import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCanonicalArticleBySlug,
  getExperimentalArticleByEventId,
  getLazyCanonicalArticleByEventId,
  getPodcastAnalysisStatus,
  requestPodcastAnalysis,
  type PodcastAnalysisStatus,
} from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const LAZY_ARTICLE_POLL_MS = 5000;
const EXPERIMENTAL_POLL_MS = 5000;
const PODCAST_POLL_MS = 5000;

const preparingCopy = {
  en: "Briefly analysis is being prepared from the event evidence…",
  es: "El análisis de Briefly se está preparando a partir de las evidencias del evento…",
  ja: "イベントの根拠情報からBrieflyの分析を準備しています…",
  "zh-CN": "Briefly 正在根据事件证据生成分析…",
  "zh-TW": "Briefly 正在根據事件證據產生分析…",
} as const;

const generationUnavailableCopy = {
  en: "Briefly could not prepare an authoritative analysis from the available source material. You can still review the original coverage and try again later.",
  es: "Briefly no pudo preparar un análisis autorizado con el material fuente disponible. Aún puedes revisar la cobertura original e intentarlo de nuevo más tarde.",
  ja: "現在利用できる情報源だけでは、Brieflyの信頼できる分析を作成できませんでした。元の報道を確認し、後でもう一度お試しください。",
  "zh-CN": "根据目前可用的来源材料，Briefly 暂时无法生成权威分析。你仍可查看原始报道，并稍后重试。",
  "zh-TW": "根據目前可用的來源材料，Briefly 暫時無法產生權威分析。你仍可查看原始報導，並稍後重試。",
} as const;

type PodcastState = {
  key: string;
  value: PodcastAnalysisStatus | null;
};

export default function StoryDetailScreen() {
  const { slug, eventId } = useLocalSearchParams<{
    slug?: string | string[];
    eventId?: string | string[];
  }>();

  const resolvedSlug = useMemo(
    () => (Array.isArray(slug) ? slug[0] : slug),
    [slug],
  );
  const resolvedEventId = useMemo(
    () => (Array.isArray(eventId) ? eventId[0] : eventId),
    [eventId],
  );

  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { user, account } = useBrieflyAuth();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [podcastState, setPodcastState] = useState<PodcastState>({
    key: "",
    value: null,
  });
  const [podcastBusy, setPodcastBusy] = useState(false);

  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${language}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error && !article;
  const isPro = account?.translation_entitled === true;
  const podcastSourceVersionId = article
    ? article.authoritative_article_version_id ?? article.article_version_id
    : null;
  const podcastRequestKey =
    isPro && podcastSourceVersionId
      ? `${podcastSourceVersionId}:${language}`
      : "";
  const podcast =
    podcastState.key === podcastRequestKey ? podcastState.value : null;

  useEffect(() => {
    if (!resolvedSlug) return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = (delay: number) => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => void load(true), delay);
    };

    const load = async (polling = false) => {
      if (!active) return;

      if (!polling) {
        setError(null);
        setLoadingKey("");
        setArticle(null);
      }

      try {
        let result: CanonicalArticle;

        if (resolvedEventId) {
          const canonical = await getLazyCanonicalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS,
          });

          if (!active) return;

          if (canonical.article_version_id == null) {
            setArticle(canonical);
            setLoadingKey(requestKey);
            setError(null);
            if (canonical.generation_status === "processing") {
              schedulePoll(LAZY_ARTICLE_POLL_MS);
            }
            return;
          }

          result =
            language !== "en"
              ? await getExperimentalArticleByEventId(resolvedEventId, {
                  includeDraft: PREVIEW_DRAFTS,
                  language,
                })
              : canonical;
        } else {
          result = await getCanonicalArticleBySlug(resolvedSlug, {
            includeDraft: PREVIEW_DRAFTS,
            language,
          });
        }

        if (!active) return;

        setArticle(result);
        setLoadingKey(requestKey);
        setError(null);

        if (
          language !== "en" &&
          resolvedEventId &&
          result.translation_status === "pending"
        ) {
          schedulePoll(EXPERIMENTAL_POLL_MS);
        }
      } catch (err: unknown) {
        if (!active) return;
        if (!polling) setArticle(null);
        setLoadingKey(requestKey);
        setError(err instanceof Error ? err.message : t.storyUnavailable);
      }
    };

    void load(false);

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    resolvedSlug,
    resolvedEventId,
    language,
    reloadKey,
    requestKey,
    t.storyUnavailable,
  ]);

  useEffect(() => {
    if (!podcastRequestKey || !podcastSourceVersionId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadStatus = async () => {
      try {
        const next = await getPodcastAnalysisStatus(
          podcastSourceVersionId,
          language,
        );
        if (!active) return;
        setPodcastState({ key: podcastRequestKey, value: next });
        if (next.status === "processing") {
          timer = setTimeout(() => void loadStatus(), PODCAST_POLL_MS);
        }
      } catch {
        if (active) {
          setPodcastState({ key: podcastRequestKey, value: null });
        }
      }
    };

    void loadStatus();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [language, podcastRequestKey, podcastSourceVersionId]);

  const handlePodcastAction = async () => {
    if (podcast?.status === "ready" && podcast.audio_url) {
      if (Platform.OS !== "web") {
        await Linking.openURL(podcast.audio_url);
      }
      return;
    }

    if (!user) {
      router.push("/sign-in");
      return;
    }
    if (!isPro) {
      router.push("/upgrade");
      return;
    }
    if (!podcastSourceVersionId || !podcastRequestKey || podcastBusy) return;

    setPodcastBusy(true);
    try {
      const next = await requestPodcastAnalysis(
        podcastSourceVersionId,
        language,
      );
      setPodcastState({ key: podcastRequestKey, value: next });
    } finally {
      setPodcastBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingStory} />
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title={t.storyUnavailable}
          message={error ?? t.articleNotFound}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </SafeAreaView>
    );
  }

  if (article.article_version_id == null) {
    const generationFailed = article.generation_status === "failed";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          loading={article.generation_status === "processing"}
          title={article.headline}
          message={
            generationFailed
              ? generationUnavailableCopy[language] ?? generationUnavailableCopy.en
              : preparingCopy[language] ?? preparingCopy.en
          }
          onRetry={
            article.generation_status === "processing"
              ? undefined
              : () => setReloadKey((value) => value + 1)
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <ArticleView
      article={article}
      podcast={podcast}
      podcastBusy={podcastBusy}
      podcastPro={isPro}
      podcastSignedIn={!!user}
      onPodcastAction={() => void handlePodcastAction()}
    />
  );
}
