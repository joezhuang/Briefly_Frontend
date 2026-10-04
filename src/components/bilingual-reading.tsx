import { useState } from "react";
import { useWindowDimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

/**
 * Section- and paragraph-level bilingual display over two already-delivered,
 * immutable article versions. Never requests/generates translations.
 */
const copy = {
  en: { mobileEnglish: "English", mobileTranslated: "Translation", bodyHint: "Tap a paragraph to compare the English original.", bodyHintAdmin: "Select text or switch the whole body.", bilingual: "Bilingual reading", original: "English original", translated: "Translation", warning: "AI translations may contain mistakes. English is the authoritative article.", mismatch: "The two versions have different paragraph structures; shown separately to avoid false alignment." },
  es: { mobileEnglish: "Inglés", mobileTranslated: "Traducción", bodyHint: "Toca un párrafo para ver el original en inglés.", bodyHintAdmin: "Selecciona texto o cambia el idioma del artículo.", bilingual: "Lectura bilingüe", original: "Original en inglés", translated: "Traducción", warning: "La traducción por IA puede contener errores. El artículo en inglés es la versión de referencia.", mismatch: "Los párrafos difieren; se muestran por separado para evitar correspondencias incorrectas." },
  ja: { mobileEnglish: "英語", mobileTranslated: "翻訳", bodyHint: "段落をタップすると英語原文に切り替わります。", bodyHintAdmin: "文章を選択するか、本文全体の言語を切り替えられます。", bilingual: "二言語で読む", original: "英語原文", translated: "翻訳版", warning: "AI翻訳には誤りが含まれる場合があります。英語原文を正本としてください。", mismatch: "段落構成が異なるため、誤った対応付けを避けて別々に表示します。" },
  "zh-CN": { mobileEnglish: "英文", mobileTranslated: "译文", bodyHint: "轻点段落即可切换到英文原文。", bodyHintAdmin: "可选择文字或切换整篇正文语言。", bilingual: "双语阅读", original: "英文原文", translated: "译文", warning: "AI 翻译可能有误，请以英文原文为准。", mismatch: "两种语言的段落结构不同，将分别展示以避免错误对应。" },
  "zh-TW": { mobileEnglish: "英文", mobileTranslated: "譯文", bodyHint: "點按段落即可切換到英文原文。", bodyHintAdmin: "可選取文字或切換整篇內文語言。", bilingual: "雙語閱讀", original: "英文原文", translated: "譯文", warning: "AI 翻譯可能有誤，請以英文原文為準。", mismatch: "兩種語言的段落結構不同，將分別顯示以避免錯誤對應。" },
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
  heading,
}: {
  localized: string;
  english: string;
  stacked: boolean;
  selectable: boolean;
  heading?: string;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;
  const [mobileLanguage, setMobileLanguage] = useState<"translated" | "english">("translated");

  // Independent paragraph/section toggle: no network request, and both versions
  // remain loaded. Desktop retains the familiar side-by-side comparison.
  if (stacked) {
    return (
      <View style={styles.summaryMobilePair}>
        <View style={styles.sectionHeadingRow}>
          <Text numberOfLines={2} style={[styles.sectionTitle, styles.sectionHeadingText, { color: colors.accent }]}>
            {heading}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mobileLanguage === "translated" ? label.mobileEnglish : label.mobileTranslated}
            onPress={() => setMobileLanguage((current) =>
              current === "translated" ? "english" : "translated",
            )}
            style={[styles.mobileSwitcher, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.mobileOptionText, { color: colors.accent }]}>
              {mobileLanguage === "translated" ? label.mobileEnglish : label.mobileTranslated} ↔
            </Text>
          </Pressable>
        </View>
        <Text selectable={selectable} style={[styles.paragraph, { color: colors.text }]}>
          {(mobileLanguage === "translated" ? localized : english) || "—"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.pair, { borderColor: colors.border }]}>
      <View style={styles.column}>
        <Text style={[styles.columnLabel, { color: colors.accent }]}>{label.translated}</Text>
        <Text selectable={selectable} style={[styles.paragraph, { color: colors.text }]}>{localized || "—"}</Text>
      </View>
      <View style={styles.column}>
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
      <Text style={[styles.header, { color: colors.text }]}>
        {label.bilingual}
        {latestEnglishVersionId != null &&
          english.article_version_id !== latestEnglishVersionId
            ? ` · v${english.version_number ?? english.article_version_id}`
            : ""}
      </Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>{label.warning}</Text>
      {sections.map(([field, localizedLabel, englishLabel]) => (
        <View key={field} style={styles.section}>
          {!stacked && (
            <Text style={[styles.sectionTitle, { color: colors.accent }]}>
              {t[localizedLabel]} / {englishLabel}
            </Text>
          )}
          <BilingualPair
            heading={t[localizedLabel]}
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

function TappableBodyParagraph({
  localized,
  english,
  englishHint,
  translatedHint,
}: {
  localized: string;
  english: string;
  englishHint: string;
  translatedHint: string;
}) {
  const { colors } = useBrieflyTheme();
  const [showEnglish, setShowEnglish] = useState(false);
  const currentText = (showEnglish ? english : localized) || "—";
  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={currentText}
      accessibilityHint={showEnglish ? translatedHint : englishHint}
      onPress={() => setShowEnglish((current) => !current)}
      style={[styles.bodyParagraph, { color: colors.text }]}
    >
      {showEnglish && (
        <Text style={[styles.inlineEnglishMark, { color: colors.accent }]}>EN · </Text>
      )}
      {currentText}
    </Text>
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
  const [wholeBodyEnglish, setWholeBodyEnglish] = useState(false);
  const localizedParagraphs = translated.body ?? [];
  const englishParagraphs = english.body ?? [];
  // Only allow passage-level comparison when order and paragraph types match.
  const aligned = localizedParagraphs.length === englishParagraphs.length &&
    localizedParagraphs.every((paragraph, index) => paragraph.type === englishParagraphs[index].type);

  if (!stacked) {
    if (!aligned) {
      return (
        <View style={styles.body}>
          <Text style={[styles.note, { color: colors.textMuted }]}>{label.mismatch}</Text>
          <View style={[styles.pair, { borderColor: colors.border }]}>
            {([
              { label: label.translated, paragraphs: localizedParagraphs },
              { label: label.original, paragraphs: englishParagraphs },
            ] as const).map((column, index) => (
              <View key={index} style={styles.column}>
                <Text style={[styles.columnLabel, { color: colors.accent }]}>{column.label}</Text>
                {column.paragraphs.map((paragraph, i) => (
                  <Text
                    key={i}
                    selectable={selectable}
                    style={[styles.paragraph, styles.separateParagraph, { color: colors.text }]}
                  >
                    {paragraph.text}
                  </Text>
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
            stacked={false}
            selectable={selectable}
          />
        ))}
      </View>
    );
  }

  // Admins keep the existing long-press/text selection behaviour. A whole-body
  // switch is also necessary when paragraphs cannot be safely aligned.
  const needsWholeBodySwitch = selectable || !aligned;
  const switchWholeBody = needsWholeBodySwitch ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={wholeBodyEnglish ? label.mobileTranslated : label.mobileEnglish}
      onPress={() => setWholeBodyEnglish((current) => !current)}
      style={[styles.mobileSwitcher, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.mobileOptionText, { color: colors.accent }]}>
        {wholeBodyEnglish ? label.mobileTranslated : label.mobileEnglish} ↔
      </Text>
    </Pressable>
  ) : null;

  if (!aligned) {
    const paragraphs = wholeBodyEnglish ? englishParagraphs : localizedParagraphs;
    return (
      <View style={styles.mobileBody}>
        <View style={styles.bodyHintRow}>
          <Text style={[styles.bodyHint, { color: colors.textMuted }]}>{label.mismatch}</Text>
          {switchWholeBody}
        </View>
        {paragraphs.map((paragraph, index) => (
          <Text
            key={index}
            selectable={selectable}
            style={[styles.bodyParagraph, { color: colors.text }]}
          >
            {paragraph.text}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.mobileBody}>
      <View style={styles.bodyHintRow}>
        <Text style={[styles.bodyHint, { color: colors.textMuted }]}>
          {selectable ? label.bodyHintAdmin : label.bodyHint}
        </Text>
        {switchWholeBody}
      </View>
      {localizedParagraphs.map((paragraph, index) =>
        selectable ? (
          <Text
            key={index}
            selectable
            style={[styles.bodyParagraph, { color: colors.text }]}
          >
            {(wholeBodyEnglish ? englishParagraphs[index].text : paragraph.text) || "—"}
          </Text>
        ) : (
          <TappableBodyParagraph
            key={`${translated.article_version_id}:${english.article_version_id}:${index}`}
            localized={paragraph.text}
            english={englishParagraphs[index].text}
            englishHint={label.mobileEnglish}
            translatedHint={label.mobileTranslated}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brief: { marginTop: 34, padding: 18, borderRadius: 18, gap: 22 },
  header: { fontSize: 20, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 20 },
  section: { gap: 8 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 },
  sectionHeadingText: { flex: 1, minWidth: 0 },
  summaryMobilePair: { gap: 5 },
  sectionTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  pair: { flexDirection: "row", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 16 },
  mobileSwitcher: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, minHeight: 44, paddingHorizontal: 13, justifyContent: "center", alignSelf: "flex-end" },
  mobileOptionText: { fontSize: 12, fontWeight: "800" },
  column: { flex: 1, minWidth: 0, gap: 8 },
  columnLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  paragraph: { fontSize: 16, lineHeight: 26 },
  body: { marginTop: 34, gap: 18 },
  mobileBody: { marginTop: 34, gap: 24 },
  bodyHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bodyHint: { flex: 1, fontSize: 12, lineHeight: 17 },
  bodyParagraph: { fontSize: 19, lineHeight: 31 },
  inlineEnglishMark: { fontSize: 12, fontWeight: "800" },
  separateParagraph: { marginBottom: 14 },
});
