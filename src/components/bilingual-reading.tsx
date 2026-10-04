import { useWindowDimensions, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

/**
 * Section- and paragraph-level bilingual display over two already-delivered,
 * immutable article versions. Never requests/generates translations.
 */
const copy = {
  en: { bilingual: "Bilingual reading", original: "English original", translated: "Translation", warning: "AI translations may contain mistakes. English is the authoritative article.", mismatch: "The two versions have different paragraph structures; shown separately to avoid false alignment." },
  es: { bilingual: "Lectura bilingüe", original: "Original en inglés", translated: "Traducción", warning: "La traducción por IA puede contener errores. El artículo en inglés es la versión de referencia.", mismatch: "Los párrafos difieren; se muestran por separado para evitar correspondencias incorrectas." },
  ja: { bilingual: "二言語で読む", original: "英語原文", translated: "翻訳版", warning: "AI翻訳には誤りが含まれる場合があります。英語原文を正本としてください。", mismatch: "段落構成が異なるため、誤った対応付けを避けて別々に表示します。" },
  "zh-CN": { bilingual: "双语阅读", original: "英文原文", translated: "译文", warning: "AI 翻译可能有误，请以英文原文为准。", mismatch: "两种语言的段落结构不同，将分别展示以避免错误对应。" },
  "zh-TW": { bilingual: "雙語閱讀", original: "英文原文", translated: "譯文", warning: "AI 翻譯可能有誤，請以英文原文為準。", mismatch: "兩種語言的段落結構不同，將分別顯示以避免錯誤對應。" },
} as const;

const sections = [
  ["what_happened", "whatHappened", "What happened"],
  ["why_it_matters", "whyItMatters", "Why it matters"],
  ["what_next", "whatNext", "What next"],
] as const;

export function matchedBilingualOriginal(
  localized: CanonicalArticle,
  english: CanonicalArticle | null,
): CanonicalArticle | null {
  if (!english || localized.article_version_id == null || english.article_version_id == null) return null;
  if (localized.event_id !== english.event_id) return null;
  if ((english.content_language ?? english.language) !== "en") return null;
  if ((localized.content_language ?? localized.language) === "en") return null;
  if (localized.translation_status === "pending") return null;
  // A number is required: matching merely on event ID would conflate revisions.
  const sourceVersionId = localized.translation_source_article_version_id ?? localized.authoritative_article_version_id;
  return sourceVersionId === english.article_version_id ? english : null;
}

function BilingualPair({
  localized,
  english,
  stacked,
  selectable,
}: {
  localized: string;
  english: string;
  stacked: boolean;
  selectable: boolean;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;
  return (
    <View style={[styles.pair, stacked && styles.pairStacked, { borderColor: colors.border }]}>
      <View style={styles.column}>
        <Text style={[styles.columnLabel, { color: colors.accent }]}>{label.translated}</Text>
        <Text selectable={selectable} style={[styles.paragraph, { color: colors.text }]}>{localized || "—"}</Text>
      </View>
      <View style={[styles.column, stacked && styles.stackedEnglish, stacked && { borderTopColor: colors.border }]}>
        <Text style={[styles.columnLabel, { color: colors.textMuted }]}>{label.original}</Text>
        <Text selectable={selectable} style={[styles.paragraph, { color: colors.text }]}>{english || "—"}</Text>
      </View>
    </View>
  );
}

export function BilingualBrief({
  translated,
  english,
  selectable,
  latestEnglishVersionId = null,
}: {
  translated: CanonicalArticle;
  english: CanonicalArticle;
  selectable: boolean;
  latestEnglishVersionId?: number | null;
}) {
  const { language, t } = useBrieflyLanguage();
  const { width } = useWindowDimensions();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;
  const stacked = width < 800;
  return (
    <View style={[styles.brief, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.header, { color: colors.text }]}>{label.bilingual}</Text>
      {latestEnglishVersionId != null && latestEnglishVersionId !== english.article_version_id && (
        <Text style={[styles.note, { color: colors.accent }]}>
          {language === "ja"
            ? `以前の版です：この翻訳と英語原文は同じ旧版（ID ${english.article_version_id}）に基づきます。最新版（ID ${latestEnglishVersionId}）の変更は含まれない場合があります。`
            : language === "zh-CN"
              ? `较早版本：译文与英文原文均对应旧版（ID ${english.article_version_id}），不一定包含当前版本（ID ${latestEnglishVersionId}）的更新。`
              : language === "zh-TW"
                ? `較早版本：譯文與英文原文均對應舊版（ID ${english.article_version_id}），不一定包含目前版本（ID ${latestEnglishVersionId}）的更新。`
                : language === "es"
                  ? `Versión anterior: la traducción y el original corresponden a la versión ${english.article_version_id}. La versión actual ${latestEnglishVersionId} puede incluir novedades.`
                  : `Earlier version: both columns use English source version ${english.article_version_id}, not the latest version ${latestEnglishVersionId}. New developments may be missing.`}
        </Text>
      )}
      <Text style={[styles.note, { color: colors.textMuted }]}>{label.warning}</Text>
      {sections.map(([field, localizedLabel, englishLabel]) => (
        <View key={field} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            {t[localizedLabel]} / {englishLabel}
          </Text>
          <BilingualPair
            localized={String(translated[field] || "")}
            english={String(english[field] || "")}
            stacked={stacked}
            selectable={selectable}
          />
        </View>
      ))}
    </View>
  );
}

export function BilingualBody({
  translated,
  english,
  selectable,
}: {
  translated: CanonicalArticle;
  english: CanonicalArticle;
  selectable: boolean;
}) {
  const { language } = useBrieflyLanguage();
  const { width } = useWindowDimensions();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;
  const stacked = width < 800;
  const localizedParagraphs = translated.body ?? [];
  const englishParagraphs = english.body ?? [];
  // Only claim paragraph alignment when count and paragraph types agree.
  const aligned = localizedParagraphs.length === englishParagraphs.length &&
    localizedParagraphs.every((paragraph, index) => paragraph.type === englishParagraphs[index].type);

  if (!aligned) {
    return (
      <View style={styles.body}>
        <Text style={[styles.note, { color: colors.textMuted }]}>{label.mismatch}</Text>
        <View style={[styles.pair, stacked && styles.pairStacked, { borderColor: colors.border }]}>
          {([
            { label: label.translated, paragraphs: localizedParagraphs },
            { label: label.original, paragraphs: englishParagraphs },
          ] as const).map((column, index) => (
            <View key={index} style={[styles.column, stacked && index === 1 && styles.stackedEnglish, stacked && index === 1 && { borderTopColor: colors.border }]}>
              <Text style={[styles.columnLabel, { color: colors.accent }]}>{column.label}</Text>
              {column.paragraphs.map((paragraph, i) => (
                <Text key={i} selectable={selectable} style={[styles.paragraph, styles.separateParagraph, { color: colors.text }]}>{paragraph.text}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      {localizedParagraphs.map((paragraph, index) => (
        <BilingualPair
          key={index}
          localized={paragraph.text}
          english={englishParagraphs[index].text}
          stacked={stacked}
          selectable={selectable}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  brief: { marginTop: 34, padding: 18, borderRadius: 18, gap: 22 },
  header: { fontSize: 20, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  pair: { flexDirection: "row", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 16 },
  pairStacked: { flexDirection: "column", gap: 12 },
  column: { flex: 1, minWidth: 0, gap: 8 },
  stackedEnglish: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  columnLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  paragraph: { fontSize: 16, lineHeight: 26 },
  body: { marginTop: 34, gap: 18 },
  separateParagraph: { marginBottom: 14 },
});
