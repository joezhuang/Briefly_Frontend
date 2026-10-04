import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

// Route matches the stable HTTPS /s/{eventId} shared by the website. The
// native app can navigate using the durable event ID without fetching first,
// so opening a shared link cannot trigger additional paid generation.
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UI_LANGUAGES = new Set(["en", "es", "ja", "zh-CN", "zh-TW"]);
const READ_LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/;

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SharedEventLinkScreen() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    ui?: string | string[];
    content?: string | string[];
    read?: string | string[];
    mode?: string | string[];
    translationVersion?: string | string[];
    englishVersion?: string | string[];
  }>();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const destination = useMemo(() => {
    const eventId = String(single(params.eventId) ?? "").trim();
    if (!EVENT_ID.test(eventId)) return "/";

    const search = new URLSearchParams({
      eventId,
      source: "share",
    });
    const ui = single(params.ui);
    const content = single(params.content);
    const read = single(params.read);
    if (ui && UI_LANGUAGES.has(ui)) search.set("ui", ui);
    if (content && UI_LANGUAGES.has(content)) search.set("content", content);
    if (read && READ_LANGUAGE.test(read)) search.set("read", read);
    const translationVersion = Number(single(params.translationVersion));
    const englishVersion = Number(single(params.englishVersion));
    if (single(params.mode) === "bilingual" &&
        Number.isSafeInteger(translationVersion) && translationVersion > 0 &&
        Number.isSafeInteger(englishVersion) && englishVersion > 0) {
      search.set("mode", "bilingual");
      search.set("translationVersion", String(translationVersion));
      search.set("englishVersion", String(englishVersion));
    }

    return `/story/${encodeURIComponent(eventId)}?${search.toString()}`;
  }, [params.eventId, params.ui, params.content, params.read, params.mode, params.translationVersion, params.englishVersion]);

  useEffect(() => {
    router.replace(destination as never);
  }, [destination]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenState loading message={t.loadingSharedStory} />
    </SafeAreaView>
  );
}
