import { useEffect, useState } from "react";
import { ActivityIndicator, useWindowDimensions, Pressable, StyleSheet, Text, View } from "react-native";

import {
  BilingualSpeechButton,
  EnglishSpeechButton,
  EnglishVoicePicker,
} from "@/components/english-speech-button";
import { useEnglishSpeech } from "@/context/english-speech";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

/**
 * Section- and paragraph-level bilingual display over two already-delivered,
 * immutable article versions. Never requests/generates translations.
 */
const copy = {
  en: { retryMissing: "Retry missing translation", retrying: "Repairing…", mobileEnglish: "English", mobileTranslated: "Translation", bodyHint: "Tap a paragraph to compare the English original.", bodyHintAdmin: "Select text or switch the whole body.", bilingual: "Bilingual reading", original: "English original", translated: "Translation", warning: "AI translations may contain mistakes. English is the authoritative article.", mismatch: "The two versions have different paragraph structures; shown separately to avoid false alignment." },
  es: { retryMissing: "Reintentar traducción faltante", retrying: "Reparando…", mobileEnglish: "Inglés", mobileTranslated: "Traducción", bodyHint: "Toca un párrafo para ver el original en inglés.", bodyHintAdmin: "Selecciona texto o cambia el idioma del artículo.", bilingual: "Lectura bilingüe", original: "Original en inglés", translated: "Traducción", warning: "La traducción por IA puede contener errores. El artículo en inglés es la versión de referencia.", mismatch: "Los párrafos difieren; se muestran por separado para evitar correspondencias incorrectas." },
  ja: { retryMissing: "不足している翻訳を再試行", retrying: "修復中…", mobileEnglish: "英語", mobileTranslated: "翻訳", bodyHint: "段落をタップすると英語原文に切り替わります。", bodyHintAdmin: "文章を選択するか、本文全体の言語を切り替えられます。", bilingual: "二言語で読む", original: "英語原文", translated: "翻訳版", warning: "AI翻訳には誤りが含まれる場合があります。英語原文を正本としてください。", mismatch: "段落構成が異なるため、誤った対応付けを避けて別々に表示します。" },
  "zh-CN": { retryMissing: "重试缺失的译文", retrying: "正在修复…", mobileEnglish: "英文", mobileTranslated: "译文", bodyHint: "轻点段落即可切换到英文原文。", bodyHintAdmin: "可选择文字或切换整篇正文语言。", bilingual: "双语阅读", original: "英文原文", translated: "译文", warning: "AI 翻译可能有误，请以英文原文为准。", mismatch: "两种语言的段落结构不同，将分别展示以避免错误对应。" },
  "zh-TW": { retryMissing: "重試缺失的譯文", retrying: "正在修復…", mobileEnglish: "英文", mobileTranslated: "譯文", bodyHint: "點按段落即可切換到英文原文。", bodyHintAdmin: "可選取文字或切換整篇內文語言。", bilingual: "雙語閱讀", original: "英文原文", translated: "譯文", warning: "AI 翻譯可能有誤，請以英文原文為準。", mismatch: "兩種語言的段落結構不同，將分別顯示以避免錯誤對應。" },
} as const;

const sections = [
  ["what_happened", "whatHappened", "What happened"],
  ["why_it_matters", "whyItMatters", "Why it matters"],
  ["what_next", "whatNext", "What next"],
] as const;

// Compare immutable version identity without holding onto a mutable article
// object. Story-open reconciliation may use this while its async status lookup
// is in flight; the full English article is only required for display.
export function translationMatchesEnglishVersion(
  localized: CanonicalArticle,
  englishEventId: string,
  englishVersionId: number,
): boolean {
  if (localized.article_version_id == null) return false;
  if (localized.event_id !== englishEventId) return false;
  if ((localized.content_language ?? localized.language) === "en") return false;
  if (localized.translation_status === "pending") return false;
  // Matching merely on event ID would conflate distinct English revisions.
  const sourceVersionId = localized.translation_source_article_version_id ?? localized.authoritative_article_version_id;
  return sourceVersionId === englishVersionId;
}

export function matchedBilingualOriginal(
  localized: CanonicalArticle,
  english: CanonicalArticle | null,
): CanonicalArticle | null {
  if (!english || english.article_version_id == null ||
      (english.content_language ?? english.language) !== "en") return null;
  return translationMatchesEnglishVersion(
    localized, english.event_id, english.article_version_id,
  ) ? english : null;
}

function BilingualPair({
  localized,
  english,
  stacked,
  selectable,
  heading,
  passageId,
  translatedLanguage,
}: {
  localized: string;
  english: string;
  passageId: string;
  translatedLanguage: string;
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
          <View style={styles.sectionActions}>
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
            <BilingualSpeechButton
              passageId={passageId}
              translated={localized}
              english={english}
              translatedLanguage={translatedLanguage}
              compact
            />
          </View>
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
        <View style={styles.englishColumnHeading}>
          <Text style={[styles.columnLabel, { color: colors.textMuted }]}>{label.original}</Text>
          <BilingualSpeechButton
            passageId={passageId}
            translated={localized}
            english={english}
            translatedLanguage={translatedLanguage}
            compact
          />
        </View>
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
  onRetryMissingSection,
  retryingMissingSection = false,
  englishRetryAvailable = false,
}: {
  translated: CanonicalArticle;
  english: CanonicalArticle;
  selectable: boolean;
  latestEnglishVersionId?: number | null;
  onRetryMissingSection?: (field: "what_happened" | "why_it_matters" | "what_next") => void;
  retryingMissingSection?: boolean;
  englishRetryAvailable?: boolean;
}) {
  const { language, t } = useBrieflyLanguage();
  const { width } = useWindowDimensions();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;
  const stacked = width < 800;
  const translatedLanguage =
    translated.content_language ?? translated.language ?? language;
  return (
    <View style={[styles.brief, { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.bilingualHeader}>
        {!stacked && (
          <Text style={[styles.header, { color: colors.text }]}>
            {label.bilingual}
            {latestEnglishVersionId != null &&
              english.article_version_id !== latestEnglishVersionId
                ? ` · v${english.version_number ?? english.article_version_id}`
                : ""}
          </Text>
        )}
        <EnglishVoicePicker />
      </View>
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
            passageId={`${english.article_version_id}:summary:${field}`}
            translatedLanguage={translatedLanguage}
            stacked={stacked}
            selectable={selectable}
          />
          {!String(translated[field] ?? "").trim() &&
            (String(english[field] ?? "").trim() || englishRetryAvailable) &&
            onRetryMissingSection ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t[localizedLabel]}: ${label.retryMissing}`}
                disabled={retryingMissingSection}
                onPress={() => onRetryMissingSection(field)}
                style={[styles.retrySectionButton, { borderColor: colors.border }]}
              >
                {retryingMissingSection && <ActivityIndicator size="small" color={colors.accent} />}
                <Text style={[styles.retrySectionText, { color: colors.accent }]}>
                  {retryingMissingSection ? label.retrying : label.retryMissing}
                </Text>
              </Pressable>
            ) : null}
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
  passageId,
  translatedLanguage,
  selectable = false,
  initiallyEnglish = false,
}: {
  localized: string;
  english: string;
  passageId: string;
  englishHint: string;
  translatedHint: string;
  translatedLanguage: string;
  selectable?: boolean;
  initiallyEnglish?: boolean;
}) {
  const { colors } = useBrieflyTheme();
  const [showEnglish, setShowEnglish] = useState(initiallyEnglish);
  const englishAvailable = !!english.trim();
  const currentText = (showEnglish ? english : localized) || "—";
  const switchLanguage = () => setShowEnglish((current) => !current);

  return (
    <View style={styles.bodyParagraphItem}>
      {englishAvailable && (
        <View style={styles.bodyParagraphControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showEnglish ? translatedHint : englishHint}
            accessibilityState={{ selected: showEnglish }}
            onPress={switchLanguage}
            style={[styles.mobileSwitcher, styles.paragraphLanguageButton, {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }]}
          >
            <Text style={[styles.mobileOptionText, { color: colors.accent }]}>
              {showEnglish ? translatedHint : "EN"} ↔
            </Text>
          </Pressable>
          <BilingualSpeechButton
            passageId={passageId}
            translated={localized}
            english={english}
            translatedLanguage={translatedLanguage}
            compact
          />
        </View>
      )}
      <Text
        selectable={selectable}
        accessibilityRole={selectable || !englishAvailable ? undefined : "button"}
        accessibilityLabel={currentText}
        accessibilityHint={selectable || !englishAvailable ? undefined : (showEnglish ? translatedHint : englishHint)}
        onPress={!selectable && englishAvailable ? switchLanguage : undefined}
        style={[styles.bodyParagraph, { color: colors.text }]}
      >
        {currentText}
      </Text>
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
  const { stop } = useEnglishSpeech();
  const label = copy[language] ?? copy.en;
  const stacked = width < 800;
  const translatedLanguage =
    translated.content_language ?? translated.language ?? language;
  const [wholeBodyEnglish, setWholeBodyEnglish] = useState(false);
  // Leaving Bilingual mode removes these controls. Don't leave an old passage
  // speaking while the user is back in the English-only/translated-only view.
  useEffect(() => () => { stop(); }, [stop]);
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
                  <View key={i} style={styles.column}>
                    {index === 1 && (
                      <View style={styles.bodyParagraphControls}>
                        <Text style={[styles.columnLabel, { color: colors.textMuted }]}>EN</Text>
                        <EnglishSpeechButton
                          passageId={`${english.article_version_id}:body:${i}`}
                          english={paragraph.text}
                          compact
                        />
                      </View>
                    )}
                    <Text selectable={selectable} style={[styles.paragraph, styles.separateParagraph, { color: colors.text }]}>
                      {paragraph.text}
                    </Text>
                  </View>
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
            passageId={`${english.article_version_id}:body:${index}`}
            translatedLanguage={translatedLanguage}
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
          <View key={index} style={styles.bodyParagraphItem}>
            {wholeBodyEnglish && (
              <View style={styles.bodyParagraphControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label.mobileTranslated}
                  onPress={() => setWholeBodyEnglish(false)}
                  style={[styles.mobileSwitcher, styles.paragraphLanguageButton, {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }]}
                >
                  <Text style={[styles.mobileOptionText, { color: colors.accent }]}>
                    {label.mobileTranslated} ↔
                  </Text>
                </Pressable>
                <EnglishSpeechButton
                  passageId={`${english.article_version_id}:body:${index}`}
                  english={paragraph.text}
                  compact
                />
              </View>
            )}
            <Text selectable={selectable} style={[styles.bodyParagraph, { color: colors.text }]}>
              {paragraph.text}
            </Text>
          </View>
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
      {localizedParagraphs.map((paragraph, index) => (
        <TappableBodyParagraph
          key={`${translated.article_version_id}:${english.article_version_id}:${index}:${wholeBodyEnglish}`}
          localized={paragraph.text}
          english={englishParagraphs[index].text}
          passageId={`${english.article_version_id}:body:${index}`}
          englishHint={label.mobileEnglish}
          translatedHint={label.mobileTranslated}
          translatedLanguage={translatedLanguage}
          selectable={selectable}
          initiallyEnglish={selectable && wholeBodyEnglish}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  brief: { marginTop: 16, padding: 18, borderRadius: 16, gap: 18 },
  header: { fontSize: 20, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 20 },
  section: { gap: 8 },
  englishColumnHeading: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap", gap: 8 },
  bodyParagraphItem: { gap: 6 },
  bodyParagraphControls: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  bilingualHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  retrySectionButton: { alignSelf: "flex-start", minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  retrySectionText: { fontSize: 12, fontWeight: "800" },
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
  paragraphLanguageButton: { alignSelf: "auto" },
  separateParagraph: { marginBottom: 14 },
});
