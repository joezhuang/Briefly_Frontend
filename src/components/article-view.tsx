import { Image } from "expo-image";
import { router } from "expo-router";
import { createElement, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { PodcastAnalysisStatus } from "@/api/briefly";
import { PodcastInlinePlayer } from "@/components/podcast-inline-player";
import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const PODCAST_VOLUME_STORAGE_KEY = "briefly.podcast.volume.v1";

const localizationCopy = {
  en: {
    pendingTitle: "Experimental translation is being prepared",
    pendingText: "Showing the English original for now. This page will update automatically when the local translation is ready.",
    readyTitle: "Experimental translation",
    readyText: "This AI-generated translation may contain inaccuracies or awkward wording. Refer to the original English article for authoritative content.",
    availableText: "AI translation is available in other supported languages. Existing translations can be read by everyone; Briefly Pro can generate one when it is not yet available.",
  },
  es: {
    pendingTitle: "Traducción experimental en preparación",
    pendingText: "Por ahora mostramos el artículo original en inglés. Esta página se actualizará automáticamente cuando la traducción local esté lista.",
    readyTitle: "Traducción experimental",
    readyText: "Esta traducción generada por IA puede contener errores o expresiones poco naturales. Consulta el artículo original en inglés como fuente de referencia.",
    availableText: "La traducción por IA está disponible en otros idiomas compatibles. Todos pueden leer las traducciones existentes; Briefly Pro puede generar una cuando aún no esté disponible.",
  },
  ja: {
    pendingTitle: "実験的な翻訳を準備しています",
    pendingText: "現在は英語の原文を表示しています。ローカル翻訳の準備ができると、このページは自動的に更新されます。",
    readyTitle: "実験的な翻訳",
    readyText: "このAI生成翻訳には誤りや不自然な表現が含まれる可能性があります。正確な内容は英語の原文を参照してください。",
    availableText: "AI翻訳は他の対応言語でも利用できます。既存の翻訳は誰でも閲覧でき、まだない翻訳はBriefly Proで生成できます。",
  },
  "zh-CN": {
    pendingTitle: "正在准备实验性翻译",
    pendingText: "目前先显示英文原文。本地翻译准备好后，此页面会自动更新。",
    readyTitle: "实验性翻译",
    readyText: "此翻译由 AI 生成，可能包含错误或不自然的表述。权威内容请以英文原文为准。",
    availableText: "AI 翻译支持其他语言。已有翻译所有用户均可阅读；如果尚无对应翻译，Briefly Pro 可生成翻译。",
  },
  "zh-TW": {
    pendingTitle: "正在準備實驗性翻譯",
    pendingText: "目前先顯示英文原文。本地翻譯準備完成後，此頁面會自動更新。",
    readyTitle: "實驗性翻譯",
    readyText: "此翻譯由 AI 產生，可能包含錯誤或不自然的表述。權威內容請以英文原文為準。",
    availableText: "AI 翻譯支援其他語言。已有翻譯所有使用者均可閱讀；如果尚無對應翻譯，Briefly Pro 可產生翻譯。",
  },
} as const;

const imageFitCopy = {
  en: { fill: "Fill", full: "Full image", fillLabel: "Fill image frame", fullLabel: "Show full image" },
  es: { fill: "Rellenar", full: "Imagen completa", fillLabel: "Rellenar el marco de la imagen", fullLabel: "Mostrar imagen completa" },
  ja: { fill: "画面に合わせる", full: "全体表示", fillLabel: "画像を枠いっぱいに表示", fullLabel: "画像全体を表示" },
  "zh-CN": { fill: "填满", full: "完整图片", fillLabel: "填满图片区域", fullLabel: "显示完整图片" },
  "zh-TW": { fill: "填滿", full: "完整圖片", fillLabel: "填滿圖片區域", fullLabel: "顯示完整圖片" },
} as const;

const podcastCopy = {
  en: { title: "Podcast analysis", body: "A two-host Deeply analysis generated from the authoritative English Briefly article.", proOnly: "Briefly Pro", signIn: "Sign in to use podcast analysis", generate: "Generate podcast analysis", preparing: "Preparing podcast analysis…", listen: "Listen to analysis", retry: "Retry podcast analysis" },
  es: { title: "Análisis en pódcast", body: "Un análisis de Deeply con dos presentadores, generado a partir del artículo original de Briefly en inglés.", proOnly: "Briefly Pro", signIn: "Inicia sesión para usar el análisis en pódcast", generate: "Generar análisis en pódcast", preparing: "Preparando el análisis en pódcast…", listen: "Escuchar el análisis", retry: "Reintentar el análisis en pódcast" },
  ja: { title: "ポッドキャスト分析", body: "Brieflyの権威ある英語記事を基に生成する、Deeplyの2人ホストによる解説です。", proOnly: "Briefly Pro", signIn: "ポッドキャスト分析を利用するにはログインしてください", generate: "ポッドキャスト分析を生成", preparing: "ポッドキャスト分析を準備中…", listen: "分析を聴く", retry: "ポッドキャスト分析を再試行" },
  "zh-CN": { title: "播客分析", body: "由 Deeply 双主持人根据 Briefly 权威英文原文生成的深度分析。", proOnly: "Briefly Pro", signIn: "登录后使用播客分析", generate: "生成播客分析", preparing: "正在准备播客分析…", listen: "收听分析", retry: "重新生成播客分析" },
  "zh-TW": { title: "Podcast 分析", body: "由 Deeply 雙主持人根據 Briefly 權威英文原文產生的深度分析。", proOnly: "Briefly Pro", signIn: "登入後使用 Podcast 分析", generate: "產生 Podcast 分析", preparing: "正在準備 Podcast 分析…", listen: "收聽分析", retry: "重新產生 Podcast 分析" },
} as const;

const coverageCopy = {
  en: { title: "Coverage", open: "Open original" }, es: { title: "Cobertura", open: "Abrir original" }, ja: { title: "関連記事", open: "元記事を開く" }, "zh-CN": { title: "相关报道", open: "打开原文" }, "zh-TW": { title: "相關報導", open: "開啟原文" },
} as const;

const exploreCopy = {
  en: { title: "More about this story", uncertainties: "What we don't know", sources: "Sources used", coverage: "Coverage" },
  es: { title: "Más sobre esta historia", uncertainties: "Lo que no sabemos", sources: "Fuentes utilizadas", coverage: "Cobertura" },
  ja: { title: "このニュースをさらに詳しく", uncertainties: "まだ分かっていないこと", sources: "使用した情報源", coverage: "関連記事" },
  "zh-CN": { title: "更多关于这篇报道", uncertainties: "尚不确定", sources: "使用的来源", coverage: "相关报道" },
  "zh-TW": { title: "更多關於這篇報導", uncertainties: "尚不確定", sources: "使用的來源", coverage: "相關報導" },
} as const;

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function readStoredPodcastVolume() { if (Platform.OS !== "web" || typeof window === "undefined") return 1; const stored = Number(window.localStorage.getItem(PODCAST_VOLUME_STORAGE_KEY)); return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1; }
function storePodcastVolume(volume: number) { if (Platform.OS !== "web" || typeof window === "undefined") return; window.localStorage.setItem(PODCAST_VOLUME_STORAGE_KEY, String(Math.max(0, Math.min(1, volume)))); }

export function ArticleView({ article, immutable = false, podcast = null, podcastBusy = false, podcastPro = false, podcastSignedIn = false, onPodcastAction, translationAction, footer }: { article: CanonicalArticle; immutable?: boolean; podcast?: PodcastAnalysisStatus | null; podcastBusy?: boolean; podcastPro?: boolean; podcastSignedIn?: boolean; onPodcastAction?: () => void; translationAction?: ReactNode; footer?: ReactNode; }) {
  const { width } = useWindowDimensions(); const { language, t } = useBrieflyLanguage(); const { colors } = useBrieflyTheme(); const { isSaved, toggleSaved } = useSavedArticles();
  const saved = isSaved(article); const sourceCount = article.source_count ?? article.sources_used?.length ?? 0; const timestamp = formatDate(article.published_at ?? article.generated_at, language);
  const contentLanguage = article.content_language ?? article.language; const showingEnglishFallback = language !== "en" && contentLanguage === "en"; const translationPending = article.translation_status === "pending"; const experimentalTranslation = article.experimental_localization === true; const translatedContent = language !== "en" && contentLanguage !== "en" && contentLanguage === language;
  const localizationText = localizationCopy[language] ?? localizationCopy.en; const imageFitText = imageFitCopy[language] ?? imageFitCopy.en; const podcastText = podcastCopy[language] ?? podcastCopy.en; const coverageText = coverageCopy[language] ?? coverageCopy.en; const exploreText = exploreCopy[language] ?? exploreCopy.en;
  const [openExplore, setOpenExplore] = useState<"uncertainties" | "sources" | "coverage" | null>(null); const [heroFit, setHeroFit] = useState<"contain" | "cover">("contain"); const [showFloatingBack, setShowFloatingBack] = useState(false);
  const podcastProcessing = podcastBusy || podcast?.status === "processing"; const podcastReady = podcast?.status === "ready" && !!podcast.audio_url; const webPodcastReady = Platform.OS === "web" && podcastReady; const nativePodcastReady = Platform.OS !== "web" && podcastReady;
  const share = async () => { const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, ""); if (!webBase) { Alert.alert("Briefly", t.shareConfigMissing); return; } const url = `${webBase}/share/${article.article_version_id}`; await Share.share(Platform.OS === "ios" ? { message: article.headline, url } : { message: `${article.headline}\n${url}` }); };
  const openCoverage = async (url: string) => { if (Platform.OS === "web" && typeof window !== "undefined") { window.open(url, "_blank", "noopener,noreferrer"); return; } await Linking.openURL(url); };
  const briefSection = (title: string, text: string) => text ? <View style={styles.briefSection}><Text style={[styles.briefTitle, { color: colors.accent }]}>{title}</Text><Text style={[styles.briefText, { color: colors.text }]}>{text}</Text></View> : null;
  let podcastAction = podcastText.generate; let podcastDisabled = podcastBusy; if (!podcastSignedIn) podcastAction = podcastText.signIn; else if (!podcastPro) podcastAction = podcastText.proOnly; else if (podcastProcessing) { podcastAction = podcastText.preparing; podcastDisabled = true; } else if (podcast?.status === "failed") podcastAction = podcastText.retry;
  const hasLocalizationStatus = translationPending || experimentalTranslation || translatedContent;
  const showLocalizationNotice = hasLocalizationStatus || (Platform.OS !== "web" && language !== "en");
  const localizationBody = translationPending ? localizationText.pendingText : translatedContent || experimentalTranslation ? localizationText.readyText : localizationText.availableText;

  return <View style={[styles.articleRoot, { backgroundColor: colors.surface }]}><ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} onScroll={(event) => { if (!immutable) setShowFloatingBack(event.nativeEvent.contentOffset.y > 420); }} scrollEventThrottle={120}><View style={[styles.page, width < 480 && styles.pageCompact]}>
    {!!article.image_url && <View style={[styles.heroFrame, { backgroundColor: colors.imageFallback }]}><Image source={{ uri: article.image_url }} style={styles.heroImage} contentFit={heroFit} transition={180} />{!immutable && <Pressable accessibilityRole="button" accessibilityLabel={heroFit === "contain" ? imageFitText.fillLabel : imageFitText.fullLabel} onPress={() => setHeroFit(v => v === "contain" ? "cover" : "contain")} style={({pressed}) => [styles.heroFitButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? .72 : .92 }]}><Text style={[styles.heroFitButtonText,{color:colors.text}]}>{heroFit === "contain" ? imageFitText.fill : imageFitText.full}</Text></Pressable>}</View>}
    <Text style={[styles.brand,{color:colors.accent}]}>BRIEFLY</Text><Text style={[styles.headline,width<480&&styles.headlineCompact,{color:colors.text}]}>{article.headline}</Text>{!!article.standfirst&&<Text style={[styles.standfirst,width<480&&styles.standfirstCompact,{color:colors.textMuted}]}>{article.standfirst}</Text>}
    {!!translationAction && <View style={styles.translationAction}>{translationAction}</View>}
    {showLocalizationNotice && <View style={[styles.localizationNotice,{backgroundColor:colors.surfaceMuted,borderColor:colors.border}]}><View style={styles.statusTitleRow}>{translationPending&&<ActivityIndicator size="small" color={colors.accent}/>}<Text style={[styles.localizationNoticeTitle,{color:colors.text}]}>{translationPending?localizationText.pendingTitle:localizationText.readyTitle}</Text></View><Text style={[styles.localizationNoticeText,{color:colors.textMuted}]}>{localizationBody}</Text></View>}
    <View style={styles.meta}>{!!article.category&&<Text style={[styles.metaText,{color:colors.textMuted}]}>{article.category}</Text>}{!!timestamp&&<Text style={[styles.metaText,{color:colors.textMuted}]}>{timestamp}</Text>}{showingEnglishFallback&&<Text style={[styles.languageBadge,{color:colors.textMuted}]}>{t.articleContentEnglish}</Text>}<Text style={[styles.metaText,{color:colors.textMuted}]}>{sourceCount} {sourceCount===1?t.source:t.sourcesPlural}</Text>{immutable&&<Text style={[styles.snapshotBadge,{color:colors.accent}]}>{t.savedVersion}</Text>}</View>
    <View style={styles.actions}><Pressable onPress={()=>void toggleSaved(article)} style={[styles.action,{borderColor:colors.border},saved&&{backgroundColor:colors.text,borderColor:colors.text}]}><Text style={[styles.actionText,{color:saved?colors.background:colors.text}]}>{saved?t.savedAction:t.save}</Text></Pressable><Pressable onPress={()=>void share()} style={[styles.action,{borderColor:colors.border}]}><Text style={[styles.actionText,{color:colors.text}]}>{t.share}</Text></Pressable></View>
    <View style={[styles.briefCard,{backgroundColor:colors.surfaceMuted}]}>{briefSection(t.whatHappened,article.what_happened)}{briefSection(t.whyItMatters,article.why_it_matters)}{briefSection(t.whatNext,article.what_next)}</View>
    {!!onPodcastAction&&!immutable&&<View style={[styles.podcastFeature,{backgroundColor:colors.surfaceMuted,borderColor:colors.border}]}><View style={styles.podcastFeatureCopy}><View style={styles.podcastFeatureTitleRow}><Text style={[styles.podcastFeatureTitle,{color:colors.text}]}>{podcastText.title}</Text><Text style={[styles.podcastProBadge,{color:colors.accent}]}>PRO</Text></View><Text style={[styles.podcastFeatureBody,{color:colors.textMuted}]}>{podcastText.body}</Text></View>{nativePodcastReady&&podcast?.audio_url?<PodcastInlinePlayer source={podcast.audio_url}/>:webPodcastReady?createElement("audio",{controls:true,preload:"metadata",src:podcast.audio_url??undefined,onLoadedMetadata:(e:{currentTarget:HTMLAudioElement})=>{e.currentTarget.volume=readStoredPodcastVolume();},onVolumeChange:(e:{currentTarget:HTMLAudioElement})=>storePodcastVolume(e.currentTarget.volume),style:{width:"100%"}}):<Pressable disabled={podcastDisabled} onPress={onPodcastAction} style={[styles.podcastFeatureButton,{backgroundColor:colors.text},podcastDisabled&&styles.podcastButtonDisabled]}>{podcastProcessing&&<ActivityIndicator size="small" color={colors.background}/>}<Text style={[styles.podcastButtonText,{color:colors.background}]}>{podcastAction}</Text></Pressable>}</View>}
    <View style={styles.body}>{(article.body??[]).map((p,i)=><Text key={`${p.type}-${i}`} style={[styles.bodyText,{color:colors.text}]}>{p.text}</Text>)}</View>
    {!immutable&&<View style={[styles.exploreGroup,{borderTopColor:colors.border}]}><Text style={[styles.exploreTitle,{color:colors.text}]}>{exploreText.title}</Text>{(article.uncertainties??[]).length>0&&<ExploreRow label={exploreText.uncertainties} meta={String(article.uncertainties.length)} open={openExplore==="uncertainties"} colors={colors} onPress={()=>setOpenExplore(v=>v==="uncertainties"?null:"uncertainties")}>{article.uncertainties.map((item,i)=><View key={i} style={styles.bulletRow}><Text style={[styles.bullet,{color:colors.accent}]}>•</Text><Text style={[styles.bulletText,{color:colors.textMuted}]}>{item}</Text></View>)}</ExploreRow>}{(article.sources_used??[]).length>0&&<ExploreRow label={exploreText.sources} meta={String(article.sources_used.length)} open={openExplore==="sources"} colors={colors} onPress={()=>setOpenExplore(v=>v==="sources"?null:"sources")}>{article.sources_used.map((s,i)=><View key={`${s.source}-${i}`} style={styles.source}><Text style={[styles.sourceName,{color:colors.text}]}>{s.source}</Text>{!!s.contribution&&<Text style={[styles.sourceContribution,{color:colors.textMuted}]}>{s.contribution}</Text>}</View>)}</ExploreRow>}{(article.coverage??[]).length>0&&<ExploreRow label={exploreText.coverage} meta={String(article.coverage?.length??0)} open={openExplore==="coverage"} colors={colors} onPress={()=>setOpenExplore(v=>v==="coverage"?null:"coverage")}>{(article.coverage??[]).map((item,i)=>{const d=formatDate(item.published_at,language);return <Pressable key={`${item.evidence_id||item.url}-${i}`} onPress={()=>void openCoverage(item.url)} style={({pressed})=>[styles.coverageRow,{borderColor:colors.border},pressed&&styles.coveragePressed]}><View style={styles.coverageCopy}><Text style={[styles.coverageSource,{color:colors.accent}]}>{item.source}</Text>{!!item.title&&<Text style={[styles.coverageTitle,{color:colors.text}]}>{item.title}</Text>}{!!d&&<Text style={[styles.coverageMeta,{color:colors.textMuted}]}>{d}</Text>}</View><Text style={[styles.coverageOpen,{color:colors.textMuted}]}>{coverageText.open} ↗</Text></Pressable>;})}</ExploreRow>}</View>}
    {immutable&&(article.uncertainties??[]).length>0&&<View style={[styles.group,{borderTopColor:colors.border}]}><Text style={[styles.groupTitle,{color:colors.text}]}>{t.whatWeDontKnow}</Text>{article.uncertainties.map((item,i)=><View key={i} style={styles.bulletRow}><Text style={[styles.bullet,{color:colors.accent}]}>•</Text><Text style={[styles.bulletText,{color:colors.textMuted}]}>{item}</Text></View>)}</View>}{footer}
  </View></ScrollView>{!immutable&&showFloatingBack&&<Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()} style={({pressed})=>[styles.floatingBack,{backgroundColor:colors.surface,borderColor:colors.border,opacity:pressed?.72:.94}]}><Text style={[styles.floatingBackText,{color:colors.text}]}>←</Text></Pressable>}</View>;
}

function ExploreRow({label,meta,open,colors,onPress,children}:{label:string;meta?:string;open:boolean;colors:ReturnType<typeof useBrieflyTheme>["colors"];onPress:()=>void;children:ReactNode;}) { return <View style={[styles.exploreRow,{borderColor:colors.border}]}><Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[styles.exploreTrigger,{opacity:pressed?.68:1}]}><Text style={[styles.exploreLabel,{color:colors.text}]}>{label}</Text><View style={styles.exploreMetaRow}>{!!meta&&<Text style={[styles.exploreMeta,{color:colors.textMuted}]}>{meta}</Text>}<Text style={[styles.exploreArrow,{color:colors.accent}]}>{open?"−":"+"}</Text></View></Pressable>{open&&<View style={styles.exploreContent}>{children}</View>}</View>; }

const styles = StyleSheet.create({
  articleRoot:{flex:1},screen:{flex:1},scrollContent:{alignItems:"center"},page:{width:"100%",maxWidth:layout.articleMax,paddingHorizontal:20,paddingTop:24,paddingBottom:72},pageCompact:{paddingHorizontal:14,paddingTop:18},floatingBack:{position:"absolute",left:14,top:14,width:44,height:44,borderRadius:22,borderWidth:StyleSheet.hairlineWidth,alignItems:"center",justifyContent:"center"},floatingBackText:{fontSize:24,lineHeight:26,fontWeight:"900"},heroFrame:{width:"100%",aspectRatio:16/9,borderRadius:18,overflow:"hidden",marginBottom:28},heroImage:{width:"100%",height:"100%"},heroFitButton:{position:"absolute",right:10,bottom:10,minHeight:34,paddingHorizontal:12,borderRadius:999,borderWidth:StyleSheet.hairlineWidth,alignItems:"center",justifyContent:"center"},heroFitButtonText:{fontSize:12,fontWeight:"800"},brand:{fontSize:13,fontWeight:"800",letterSpacing:2.2,marginBottom:16},headline:{fontSize:42,lineHeight:49,fontWeight:"900",letterSpacing:-1.1},headlineCompact:{fontSize:34,lineHeight:40,letterSpacing:-.7},standfirst:{marginTop:18,fontSize:21,lineHeight:31},standfirstCompact:{fontSize:18,lineHeight:27},translationAction:{marginTop:22,alignSelf:"flex-start"},localizationNotice:{marginTop:22,padding:16,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,gap:5},statusTitleRow:{flexDirection:"row",alignItems:"center",gap:8},localizationNoticeTitle:{fontSize:14,fontWeight:"800",flexShrink:1},localizationNoticeText:{fontSize:13,lineHeight:19},meta:{flexDirection:"row",flexWrap:"wrap",gap:10,alignItems:"center",marginTop:18},metaText:{fontSize:13},languageBadge:{fontSize:12,fontWeight:"700"},snapshotBadge:{fontSize:12,fontWeight:"800"},actions:{flexDirection:"row",gap:10,marginTop:22},action:{paddingHorizontal:18,paddingVertical:10,borderRadius:999,borderWidth:1},actionText:{fontWeight:"800"},podcastCard:{marginTop:24,padding:18,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,gap:14},podcastCopy:{gap:5},podcastTitle:{fontSize:19,fontWeight:"900",flexShrink:1},podcastBody:{fontSize:14,lineHeight:21},podcastButton:{alignSelf:"flex-start",minHeight:42,paddingHorizontal:18,borderRadius:999,alignItems:"center",justifyContent:"center"},podcastButtonDisabled:{opacity:.6},buttonContent:{flexDirection:"row",alignItems:"center",gap:8},podcastButtonText:{fontSize:14,fontWeight:"800"},briefCard:{marginTop:34,padding:24,borderRadius:18,gap:22},briefSection:{gap:7},briefTitle:{fontSize:14,fontWeight:"800",letterSpacing:1,textTransform:"uppercase"},briefText:{fontSize:18,lineHeight:28},podcastFeature:{marginTop:22,padding:16,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,gap:12},podcastFeatureCopy:{gap:4},podcastFeatureTitleRow:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8},podcastFeatureTitle:{fontSize:17,fontWeight:"900"},podcastProBadge:{fontSize:10,fontWeight:"900",letterSpacing:.8},podcastFeatureBody:{fontSize:13,lineHeight:19},podcastFeatureButton:{alignSelf:"flex-start",minHeight:40,paddingHorizontal:16,borderRadius:999,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},body:{marginTop:38,gap:24},bodyText:{fontSize:19,lineHeight:31},exploreGroup:{marginTop:42,paddingTop:26,borderTopWidth:StyleSheet.hairlineWidth},exploreTitle:{fontSize:23,fontWeight:"900",marginBottom:10},exploreRow:{borderBottomWidth:StyleSheet.hairlineWidth},exploreTrigger:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},exploreLabel:{flex:1,fontSize:16,fontWeight:"800"},exploreMetaRow:{flexDirection:"row",alignItems:"center",gap:10},exploreMeta:{fontSize:12,fontWeight:"700"},exploreArrow:{width:20,textAlign:"center",fontSize:20,fontWeight:"700"},exploreContent:{paddingBottom:18,gap:10},podcastCompact:{gap:12,paddingBottom:2},group:{marginTop:44,paddingTop:28,borderTopWidth:StyleSheet.hairlineWidth,gap:14},groupTitle:{fontSize:24,fontWeight:"800"},bulletRow:{flexDirection:"row",gap:10},bullet:{fontSize:18,lineHeight:27},bulletText:{flex:1,fontSize:17,lineHeight:27},source:{gap:4,paddingVertical:7},sourceName:{fontSize:16,fontWeight:"700"},sourceContribution:{fontSize:15,lineHeight:22},coverageRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:16,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth},coveragePressed:{opacity:.6},coverageCopy:{flex:1,gap:4},coverageSource:{fontSize:13,fontWeight:"800"},coverageTitle:{fontSize:16,lineHeight:22,fontWeight:"600"},coverageMeta:{fontSize:12},coverageOpen:{fontSize:12,fontWeight:"700",flexShrink:0},
});
