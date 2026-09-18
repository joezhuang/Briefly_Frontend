import { Image } from "expo-image";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { BriefRepairStatus, PodcastAnalysisStatus } from "@/api/briefly";
import { EventEvidencePanel } from "@/components/event-evidence-panel";
import { EventFollowButton } from "@/components/event-follow-button";
import { PodcastInlinePlayer } from "@/components/podcast-inline-player";
import { StoryVideo } from "@/components/story-video";
import { useAnalysisReadiness } from "@/context/analysis-readiness";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const localizationCopy = {
  en:{pendingTitle:"Experimental translation is being prepared",pendingText:"Showing the English original for now. This page will update automatically when the local translation is ready.",readyTitle:"Experimental translation",readyText:"This AI-generated translation may contain inaccuracies or awkward wording. Refer to the original English article for authoritative content.",availableText:"AI translation is available in other supported languages. Existing translations can be read by everyone; Briefly Pro can generate one when it is not yet available.",signIn:"Sign in",proOnly:"Briefly Pro",preparing:"Preparing translation…",translated:"Translated",unavailable:"Translation unavailable"},
  es:{pendingTitle:"Traducción experimental en preparación",pendingText:"Por ahora mostramos el artículo original en inglés. Esta página se actualizará automáticamente cuando la traducción local esté lista.",readyTitle:"Traducción experimental",readyText:"Esta traducción generada por IA puede contener errores o expresiones poco naturales. Consulta el artículo original en inglés como fuente de referencia.",availableText:"La traducción por IA está disponible en otros idiomas compatibles. Todos pueden leer las traducciones existentes; Briefly Pro puede generar una cuando aún no esté disponible.",signIn:"Iniciar sesión",proOnly:"Briefly Pro",preparing:"Preparando traducción…",translated:"Traducido",unavailable:"Traducción no disponible"},
  ja:{pendingTitle:"実験的な翻訳を準備しています",pendingText:"現在は英語の原文を表示しています。ローカル翻訳の準備ができると、このページは自動的に更新されます。",readyTitle:"実験的な翻訳",readyText:"このAI生成翻訳には誤りや不自然な表現が含まれる可能性があります。正確な内容は英語の原文を参照してください。",availableText:"AI翻訳は他の対応言語でも利用できます。既存の翻訳は誰でも閲覧でき、まだない翻訳はBriefly Proで生成できます。",signIn:"ログイン",proOnly:"Briefly Pro",preparing:"翻訳を準備中…",translated:"翻訳済み",unavailable:"翻訳を利用できません"},
  "zh-CN":{pendingTitle:"正在准备实验性翻译",pendingText:"目前先显示英文原文。本地翻译准备好后，此页面会自动更新。",readyTitle:"实验性翻译",readyText:"此翻译由 AI 生成，可能包含错误或不自然的表述。权威内容请以英文原文为准。",availableText:"AI 翻译支持其他语言。已有翻译所有用户均可阅读；如果尚无对应翻译，Briefly Pro 可生成翻译。",signIn:"登录",proOnly:"Briefly Pro",preparing:"正在准备翻译…",translated:"已翻译",unavailable:"翻译暂不可用"},
  "zh-TW":{pendingTitle:"正在準備實驗性翻譯",pendingText:"目前先顯示英文原文。本地翻譯準備完成後，此頁面會自動更新。",readyTitle:"實驗性翻譯",readyText:"此翻譯由 AI 產生，可能包含錯誤或不自然的表述。權威內容請以英文原文為準。",availableText:"AI 翻譯支援其他語言。已有翻譯所有使用者均可閱讀；如果尚無對應翻譯，Briefly Pro 可產生翻譯。",signIn:"登入",proOnly:"Briefly Pro",preparing:"準備翻譯…",translated:"翻譯済み",unavailable:"翻譯暫不可用"},
} as const;
const podcastCopy={en:{title:"Podcast analysis",body:"A two-host Deeply analysis generated from the authoritative English Briefly article.",proOnly:"Briefly Pro",signIn:"Sign in to use podcast analysis",generate:"Generate podcast analysis",preparing:"Preparing podcast analysis…",listen:"Listen to analysis",retry:"Retry podcast analysis"},es:{title:"Análisis en pódcast",body:"Un análisis de Deeply con dos presentadores, generado a partir del artículo original de Briefly en inglés.",proOnly:"Briefly Pro",signIn:"Inicia sesión para usar el análisis en pódcast",generate:"Generar análisis en pódcast",preparing:"Preparando el análisis en pódcast…",listen:"Escuchar el análisis",retry:"Reintentar el análisis en pódcast"},ja:{title:"ポッドキャスト分析",body:"Brieflyの権威ある英語記事を基に生成する、Deeplyの2人ホストによる解説です。",proOnly:"Briefly Pro",signIn:"ポッドキャスト分析を利用するにはログインしてください",generate:"ポッドキャスト分析を生成",preparing:"ポッドキャスト分析を準備中…",listen:"分析を聴く",retry:"ポッドキャスト分析を再試行"},"zh-CN":{title:"播客分析",body:"由 Deeply 双主持人根据 Briefly 权威英文原文生成的深度分析。",proOnly:"Briefly Pro",signIn:"登录后使用播客分析",generate:"生成播客分析",preparing:"正在准备播客分析…",listen:"收听分析",retry:"重新生成播客分析"},"zh-TW":{title:"Podcast 分析",body:"由 Deeply 雙主持人根據 Briefly 權威英文原文產生的深度分析。",proOnly:"Briefly Pro",signIn:"登入後使用 Podcast 分析",generate:"產生 Podcast 分析",preparing:"準備 Podcast 分析…",listen:"收聽分析",retry:"重新產生 Podcast 分析"}} as const;
const coverageCopy={en:{title:"Coverage",open:"Open original"},es:{title:"Cobertura",open:"Abrir original"},ja:{title:"関連記事",open:"元記事を開く"},"zh-CN":{title:"相关报道",open:"打开原文"},"zh-TW":{title:"相關報導",open:"開啟原文"}} as const;
const exploreCopy={en:{title:"Explore this event",uncertainties:"What we don't know",sources:"Sources used",coverage:"Coverage"},es:{title:"Explora este evento",uncertainties:"Lo que no sabemos",sources:"Fuentes utilizadas",coverage:"Cobertura"},ja:{title:"この出来事を詳しく見る",uncertainties:"まだ分かっていないこと",sources:"使用した情報源",coverage:"関連記事"},"zh-CN":{title:"深入了解这一事件",uncertainties:"尚不确定",sources:"使用的来源",coverage:"相关报道"},"zh-TW":{title:"深入了解這一事件",uncertainties:"尚不確定",sources:"使用的來源",coverage:"相關報導"}} as const;
const mediaCopy={en:{play:"Play video"},es:{play:"Reproducir video"},ja:{play:"動画を再生"},"zh-CN":{play:"播放视频"},"zh-TW":{play:"播放影片"}} as const;
const eventCopy={
  en:{label:"EVENT",live:"Living event",updated:"Updated",sources:"sources"},
  es:{label:"EVENTO",live:"Evento en evolución",updated:"Actualizado",sources:"fuentes"},
  ja:{label:"イベント",live:"進行中の出来事",updated:"更新",sources:"情報源"},
  "zh-CN":{label:"事件",live:"持续更新",updated:"更新于",sources:"来源"},
  "zh-TW":{label:"事件",live:"持續更新",updated:"更新於",sources:"來源"},
} as const;
const briefDisclosureCopy={
  en:{more:"More",less:"Less"},
  es:{more:"Más",less:"Menos"},
  ja:{more:"続きを表示",less:"閉じる"},
  "zh-CN":{more:"展开",less:"收起"},
  "zh-TW":{more:"展開",less:"收起"},
} as const;
const briefRepairCopy={
  en:{missing:"Not available",retry:"Retry missing sections",signIn:"Sign in to retry",retrying:"Repairing…"},
  es:{missing:"No disponible",retry:"Reintentar secciones faltantes",signIn:"Inicia sesión para reintentar",retrying:"Reparando…"},
  ja:{missing:"利用できません",retry:"不足セクションを再試行",signIn:"ログインして再試行",retrying:"修復中…"},
  "zh-CN":{missing:"暂不可用",retry:"重试缺失部分",signIn:"登录后重试",retrying:"正在修复…"},
  "zh-TW":{missing:"暫不可用",retry:"重試缺失部分",signIn:"登入後重試",retrying:"正在修復…"},
} as const;

type BriefSectionId="whatHappened"|"whyItMatters"|"whatNext";

function formatDate(value:string|null|undefined,language:string){if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:new Intl.DateTimeFormat(language,{dateStyle:"medium",timeStyle:"short"}).format(date)}
function looksLikeDirectVideoUrl(value:string|null|undefined){const url=String(value||"").toLowerCase();return /\.(mp4|m4v|mov|webm|m3u8)(?:$|[?#])/.test(url)}

function BriefSummarySection({
  title,
  text,
  collapsedLines,
  expanded,
  moreLabel,
  lessLabel,
  colors,
  onToggle,
}:{
  title:string;
  text:string;
  collapsedLines?:number;
  expanded:boolean;
  moreLabel:string;
  lessLabel:string;
  colors:ReturnType<typeof useBrieflyTheme>["colors"];
  onToggle:()=>void;
}){
  const [measuredLines,setMeasuredLines]=useState(0);
  const canExpand=collapsedLines!==undefined&&measuredLines>collapsedLines;
  const showFull=collapsedLines===undefined||expanded||(measuredLines>0&&!canExpand);

  return <View style={styles.briefSection}>
    <Text style={[styles.briefTitle,{color:colors.accent}]}>{title}</Text>
    <Pressable
      accessibilityRole={canExpand?"button":undefined}
      accessibilityState={canExpand?{expanded}:undefined}
      disabled={!canExpand}
      onPress={onToggle}
      style={({pressed})=>[
        styles.briefDisclosure,
        pressed&&canExpand&&styles.briefDisclosurePressed,
      ]}
    >
      <Text
        numberOfLines={showFull?undefined:collapsedLines}
        style={[styles.briefText,{color:colors.text}]}
      >
        {text}
      </Text>
      {canExpand&&<Text style={[styles.briefMore,{color:colors.accent}]}>
        {expanded?lessLabel:moreLabel}
      </Text>}
    </Pressable>
    {collapsedLines!==undefined&&
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.briefMeasurement}
      >
        <Text
          style={styles.briefText}
          onTextLayout={(event)=>{
            const count=event.nativeEvent.lines.length;
            setMeasuredLines((current)=>current===count?current:count);
          }}
        >
          {text}
        </Text>
      </View>}
  </View>;
}

export function ArticleView({article,immutable=false,podcast=null,podcastBusy=false,podcastPro=false,podcastSignedIn=false,onPodcastAction,briefRepair=null,briefRepairBusy=false,onBriefRepair,translationAction,footer}:{article:CanonicalArticle;immutable?:boolean;podcast?:PodcastAnalysisStatus|null;podcastBusy?:boolean;podcastPro?:boolean;podcastSignedIn?:boolean;onPodcastAction?:()=>void;briefRepair?:BriefRepairStatus|null;briefRepairBusy?:boolean;onBriefRepair?:()=>void;translationAction?:ReactNode;footer?:ReactNode;}){
  const {width}=useWindowDimensions();const {language,t}=useBrieflyLanguage();const {colors}=useBrieflyTheme();const {isSaved,toggleSaved}=useSavedArticles();const {user,account}=useBrieflyAuth();const {watchTranslation}=useAnalysisReadiness();
  const saved=isSaved(article);const sourceCount=article.source_count??article.sources_used?.length??0;const timestamp=formatDate(article.published_at??article.generated_at,language);const eventUpdatedAt=formatDate(article.latest_evidence_at??article.updated_at??article.generated_at,language);
  const contentLanguage=article.content_language??article.language;const showingEnglishFallback=language!=="en"&&contentLanguage==="en";const translationPending=article.translation_status==="pending";const experimentalTranslation=article.experimental_localization===true;const translatedContent=language!=="en"&&contentLanguage!=="en"&&contentLanguage===language;
  const localizationText=localizationCopy[language]??localizationCopy.en;const podcastText=podcastCopy[language]??podcastCopy.en;const coverageText=coverageCopy[language]??coverageCopy.en;const exploreText=exploreCopy[language]??exploreCopy.en;const mediaText=mediaCopy[language]??mediaCopy.en;const eventText=eventCopy[language]??eventCopy.en;const briefDisclosureText=briefDisclosureCopy[language]??briefDisclosureCopy.en;const briefRepairText=briefRepairCopy[language]??briefRepairCopy.en;
  const [openExplore,setOpenExplore]=useState<"uncertainties"|"sources"|"coverage"|null>(null);const [showFloatingBack,setShowFloatingBack]=useState(false);const [briefExpansion,setBriefExpansion]=useState<{articleKey:string;sections:Partial<Record<BriefSectionId,boolean>>}>({articleKey:"",sections:{}});const podcastProcessing=podcastBusy||podcast?.status==="processing";const podcastReady=podcast?.status==="ready"&&!!podcast.audio_url;
  const legacyVideoUrl=looksLikeDirectVideoUrl(article.image_url)?article.image_url:null;const videoUrl=article.video_url||legacyVideoUrl;const heroImageUrl=article.video_thumbnail_url||(!looksLikeDirectVideoUrl(article.image_url)?article.image_url:null);const hasHeroMedia=!!heroImageUrl||!!videoUrl;
  const followReturnTo=`/story/${encodeURIComponent(article.slug)}?eventId=${encodeURIComponent(article.event_id)}`;
  useEffect(()=>{if(immutable||Platform.OS==="web"||language==="en"||!translationPending||!article.event_id)return;const params=new URLSearchParams({eventId:article.event_id});watchTranslation({eventId:article.event_id,language,headline:article.headline,href:`/story/${encodeURIComponent(article.slug)}?${params.toString()}`,articleVersionId:article.authoritative_article_version_id??article.article_version_id});},[article.article_version_id,article.authoritative_article_version_id,article.event_id,article.headline,article.slug,immutable,language,translationPending,watchTranslation]);
  const share=async()=>{const webBase=process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/,"");if(!webBase){Alert.alert("Briefly",t.shareConfigMissing);return}const url=`${webBase}/share/${article.article_version_id}`;await Share.share(Platform.OS==="ios"?{message:article.headline,url}:{message:`${article.headline}\n${url}`})};
  const openCoverage=async(url:string)=>{if(Platform.OS==="web"&&typeof window!=="undefined"){window.open(url,"_blank","noopener,noreferrer");return}await Linking.openURL(url)};
  const canReturnWithinBriefly=(()=>{if(Platform.OS==="web"&&typeof window!=="undefined"){const referrer=typeof document!=="undefined"?document.referrer:"";if(!referrer||window.history.length<=1)return false;try{return new URL(referrer).origin===window.location.origin}catch{return false}}return router.canGoBack()})();
  const navigateBackOrHome=()=>{if(!canReturnWithinBriefly){router.replace("/" as never);return}if(Platform.OS==="web"&&typeof window!=="undefined"){window.history.back();return}router.back()};
  const briefArticleKey=String(article.event_id||article.article_version_id||article.slug);const briefLineLimits:Record<BriefSectionId,number|undefined>=width<480?{whatHappened:4,whyItMatters:3,whatNext:3}:width<900?{whatHappened:5,whyItMatters:4,whatNext:4}:{whatHappened:undefined,whyItMatters:undefined,whatNext:undefined};const briefExpanded=(id:BriefSectionId)=>briefExpansion.articleKey===briefArticleKey&&briefExpansion.sections[id]===true;const toggleBrief=(id:BriefSectionId)=>setBriefExpansion((current)=>{const sections=current.articleKey===briefArticleKey?current.sections:{};return {articleKey:briefArticleKey,sections:{...sections,[id]:!sections[id]}}});const briefSection=(id:BriefSectionId,title:string,text:string)=>{const value=String(text||"").trim();return value?<BriefSummarySection title={title} text={value} collapsedLines={briefLineLimits[id]} expanded={briefExpanded(id)} moreLabel={briefDisclosureText.more} lessLabel={briefDisclosureText.less} colors={colors} onToggle={()=>toggleBrief(id)}/>:<View style={styles.briefSection}><Text style={[styles.briefTitle,{color:colors.accent}]}>{title}</Text><Text style={[styles.briefMissing,{color:colors.textMuted}]}>{briefRepairText.missing}</Text></View>};const hasMissingBrief=!String(article.what_happened||"").trim()||!String(article.why_it_matters||"").trim()||!String(article.what_next||"").trim();
  let podcastAction:string=podcastText.generate;let podcastDisabled=podcastBusy;if(!podcastSignedIn)podcastAction=podcastText.signIn;else if(!podcastPro)podcastAction=podcastText.proOnly;else if(podcastProcessing){podcastAction=podcastText.preparing;podcastDisabled=true}else if(podcast?.status==="failed")podcastAction=podcastText.retry;
  const hasLocalizationStatus=translationPending||experimentalTranslation||translatedContent;const showLocalizationNotice=hasLocalizationStatus||(Platform.OS!=="web"&&language!=="en");const localizationBody=translationPending?localizationText.pendingText:translatedContent||experimentalTranslation?localizationText.readyText:localizationText.availableText;const translationPro=account?.translation_entitled===true;
  let localizationAction:string=localizationText.translated;let localizationDisabled=true;let localizationPress:(()=>void)|undefined;if(translationPending)localizationAction=localizationText.preparing;else if(!(translatedContent||experimentalTranslation)){if(!user){localizationAction=localizationText.signIn;localizationDisabled=false;localizationPress=()=>router.push("/sign-in" as never)}else if(!translationPro){localizationAction=localizationText.proOnly;localizationDisabled=false;localizationPress=()=>router.push("/upgrade" as never)}else localizationAction=localizationText.unavailable}
  return <View style={[styles.articleRoot,{backgroundColor:colors.surface}]}><ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} onScroll={(event)=>{if(!immutable)setShowFloatingBack(event.nativeEvent.contentOffset.y>420)}} scrollEventThrottle={120}><View style={[styles.page,width<480&&styles.pageCompact]}>
    {hasHeroMedia&&<View style={[styles.heroFrame,{backgroundColor:colors.imageFallback}]}>{videoUrl?<StoryVideo url={videoUrl} posterUrl={heroImageUrl} accessibilityLabel={mediaText.play}/>:heroImageUrl?<Image source={{uri:heroImageUrl}} style={styles.heroImage} contentFit="cover" transition={180}/>:null}</View>}
    {!immutable?<View style={styles.eventIdentity}><View style={styles.eventIdentityTop}><View style={styles.eventLabelRow}><Text style={[styles.eventLabel,{color:colors.accent}]}>{eventText.label}</Text><View style={[styles.eventDot,{backgroundColor:colors.accent}]}/><Text style={[styles.eventLive,{color:colors.textMuted}]}>{eventText.live}</Text></View>{!!article.event_id&&<EventFollowButton eventId={article.event_id} returnTo={followReturnTo}/>}</View><View style={styles.eventMeta}>{!!eventUpdatedAt&&<Text style={[styles.eventMetaText,{color:colors.textMuted}]}>{eventText.updated} {eventUpdatedAt}</Text>}<Text style={[styles.eventMetaText,{color:colors.textMuted}]}>{sourceCount} {eventText.sources}</Text></View></View>:<Text style={[styles.brand,{color:colors.accent}]}>BRIEFLY</Text>}
    <Text style={[styles.headline,width<480&&styles.headlineCompact,{color:colors.text}]}>{article.headline}</Text>{!!article.standfirst&&<Text style={[styles.standfirst,width<480&&styles.standfirstCompact,{color:colors.textMuted}]}>{article.standfirst}</Text>}
    {!!translationAction&&<View style={styles.translationAction}>{translationAction}</View>}
    {showLocalizationNotice&&<View style={[styles.podcastFeature,{backgroundColor:colors.surfaceMuted,borderColor:colors.border}]}><View style={styles.podcastFeatureCopy}><View style={styles.podcastFeatureTitleRow}><Text style={[styles.podcastFeatureTitle,{color:colors.text}]}>{translationPending?localizationText.pendingTitle:localizationText.readyTitle}</Text><Text style={[styles.podcastProBadge,{color:colors.accent}]}>PRO</Text></View><Text style={[styles.podcastFeatureBody,{color:colors.textMuted}]}>{localizationBody}</Text></View><Pressable disabled={localizationDisabled} onPress={localizationPress} style={[styles.podcastFeatureButton,{backgroundColor:colors.text},localizationDisabled&&styles.podcastButtonDisabled]}>{translationPending&&<ActivityIndicator size="small" color={colors.background}/>}<Text style={[styles.podcastButtonText,{color:colors.background}]}>{localizationAction}</Text></Pressable></View>}
    <View style={styles.meta}>{!!article.category&&<Text style={[styles.metaText,{color:colors.textMuted}]}>{article.category}</Text>}{!!timestamp&&<Text style={[styles.metaText,{color:colors.textMuted}]}>{timestamp}</Text>}{showingEnglishFallback&&<Text style={[styles.languageBadge,{color:colors.textMuted}]}>{t.articleContentEnglish}</Text>}{immutable&&<Text style={[styles.metaText,{color:colors.textMuted}]}>{sourceCount} {sourceCount===1?t.source:t.sourcesPlural}</Text>}{immutable&&<Text style={[styles.snapshotBadge,{color:colors.accent}]}>{t.savedVersion}</Text>}</View>
    <View style={styles.actions}><Pressable onPress={()=>void toggleSaved(article)} style={[styles.action,{borderColor:colors.border},saved&&{backgroundColor:colors.text,borderColor:colors.text}]}><Text style={[styles.actionText,{color:saved?colors.background:colors.text}]}>{saved?t.savedAction:t.save}</Text></Pressable><Pressable onPress={()=>void share()} style={[styles.action,{borderColor:colors.border}]}><Text style={[styles.actionText,{color:colors.text}]}>{t.share}</Text></Pressable></View>
    <View style={[styles.briefCard,{backgroundColor:colors.surfaceMuted}]}>{briefSection("whatHappened",t.whatHappened,article.what_happened)}{briefSection("whyItMatters",t.whyItMatters,article.why_it_matters)}{briefSection("whatNext",t.whatNext,article.what_next)}{!immutable&&hasMissingBrief&&briefRepair?.available&&!!onBriefRepair&&<Pressable disabled={briefRepairBusy} onPress={onBriefRepair} style={[styles.briefRepairButton,{borderColor:colors.border},briefRepairBusy&&styles.podcastButtonDisabled]}>{briefRepairBusy&&<ActivityIndicator size="small" color={colors.accent}/>}<Text style={[styles.briefRepairButtonText,{color:colors.accent}]}>{briefRepairBusy?briefRepairText.retrying:user?briefRepairText.retry:briefRepairText.signIn}</Text></Pressable>}</View>
    {!immutable&&!!article.event_id&&<EventEvidencePanel eventId={article.event_id} uncertainties={article.uncertainties}/>} 
    {!!onPodcastAction&&!immutable&&<View style={[styles.podcastFeature,{backgroundColor:colors.surfaceMuted,borderColor:colors.border}]}><View style={styles.podcastFeatureCopy}><View style={styles.podcastFeatureTitleRow}><Text style={[styles.podcastFeatureTitle,{color:colors.text}]}>{podcastText.title}</Text><Text style={[styles.podcastProBadge,{color:colors.accent}]}>PRO</Text></View><Text style={[styles.podcastFeatureBody,{color:colors.textMuted}]}>{podcastText.body}</Text></View>{podcastReady&&podcast?.audio_url?<PodcastInlinePlayer source={podcast.audio_url} title={article.headline}/>:<Pressable disabled={podcastDisabled} onPress={onPodcastAction} style={[styles.podcastFeatureButton,{backgroundColor:colors.text},podcastDisabled&&styles.podcastButtonDisabled]}>{podcastProcessing&&<ActivityIndicator size="small" color={colors.background}/>}<Text style={[styles.podcastButtonText,{color:colors.background}]}>{podcastAction}</Text></Pressable>}</View>}
    <View style={styles.body}>{(article.body??[]).map((p,i)=><Text key={`${p.type}-${i}`} style={[styles.bodyText,{color:colors.text}]}>{p.text}</Text>)}</View>
    {!immutable&&<View style={[styles.exploreGroup,{borderTopColor:colors.border}]}><Text style={[styles.exploreTitle,{color:colors.text}]}>{exploreText.title}</Text>{(article.uncertainties??[]).length>0&&<ExploreRow label={exploreText.uncertainties} meta={String(article.uncertainties.length)} open={openExplore==="uncertainties"} colors={colors} onPress={()=>setOpenExplore(v=>v==="uncertainties"?null:"uncertainties")}>{article.uncertainties.map((item,i)=><View key={i} style={styles.bulletRow}><Text style={[styles.bullet,{color:colors.accent}]}>•</Text><Text style={[styles.bulletText,{color:colors.textMuted}]}>{item}</Text></View>)}</ExploreRow>}{(article.sources_used??[]).length>0&&<ExploreRow label={exploreText.sources} meta={String(article.sources_used.length)} open={openExplore==="sources"} colors={colors} onPress={()=>setOpenExplore(v=>v==="sources"?null:"sources")}>{article.sources_used.map((s,i)=><View key={`${s.source}-${i}`} style={styles.source}><Text style={[styles.sourceName,{color:colors.text}]}>{s.source}</Text>{!!s.contribution&&<Text style={[styles.sourceContribution,{color:colors.textMuted}]}>{s.contribution}</Text>}</View>)}</ExploreRow>}{(article.coverage??[]).length>0&&<ExploreRow label={exploreText.coverage} meta={String(article.coverage?.length??0)} open={openExplore==="coverage"} colors={colors} onPress={()=>setOpenExplore(v=>v==="coverage"?null:"coverage")}>{(article.coverage??[]).map((item,i)=>{const d=formatDate(item.published_at,language);return <Pressable key={`${item.evidence_id||item.url}-${i}`} onPress={()=>void openCoverage(item.url)} style={({pressed})=>[styles.coverageRow,{borderColor:colors.border},pressed&&styles.coveragePressed]}><View style={styles.coverageCopy}><Text style={[styles.coverageSource,{color:colors.accent}]}>{item.source}</Text>{!!item.title&&<Text style={[styles.coverageTitle,{color:colors.text}]}>{item.title}</Text>}{!!d&&<Text style={[styles.coverageMeta,{color:colors.textMuted}]}>{d}</Text>}</View><Text style={[styles.coverageOpen,{color:colors.textMuted}]}>{coverageText.open} ↗</Text></Pressable>})}</ExploreRow>}</View>}
    {immutable&&(article.uncertainties??[]).length>0&&<View style={[styles.group,{borderTopColor:colors.border}]}><Text style={[styles.groupTitle,{color:colors.text}]}>{t.whatWeDontKnow}</Text>{article.uncertainties.map((item,i)=><View key={i} style={styles.bulletRow}><Text style={[styles.bullet,{color:colors.accent}]}>•</Text><Text style={[styles.bulletText,{color:colors.textMuted}]}>{item}</Text></View>)}</View>}{footer}
  </View></ScrollView>{!immutable&&showFloatingBack&&<Pressable accessibilityRole="button" accessibilityLabel={canReturnWithinBriefly?"Back":"Home"} onPress={navigateBackOrHome} style={({pressed})=>[styles.floatingBack,{backgroundColor:colors.surface,borderColor:colors.border,opacity:pressed?.72:.94}]}><Text style={[styles.floatingBackText,{color:colors.text}]}>{canReturnWithinBriefly?"←":"⌂"}</Text></Pressable>}</View>
}
function ExploreRow({label,meta,open,colors,onPress,children}:{label:string;meta?:string;open:boolean;colors:ReturnType<typeof useBrieflyTheme>["colors"];onPress:()=>void;children:ReactNode}){return <View style={[styles.exploreRow,{borderColor:colors.border}]}><Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[styles.exploreTrigger,{opacity:pressed?.68:1}]}><Text style={[styles.exploreLabel,{color:colors.text}]}>{label}</Text><View style={styles.exploreMetaRow}>{!!meta&&<Text style={[styles.exploreMeta,{color:colors.textMuted}]}>{meta}</Text>}<Text style={[styles.exploreArrow,{color:colors.accent}]}>{open?"−":"+"}</Text></View></Pressable>{open&&<View style={styles.exploreContent}>{children}</View>}</View>}
const styles=StyleSheet.create({articleRoot:{flex:1},screen:{flex:1},scrollContent:{alignItems:"center"},page:{width:"100%",maxWidth:layout.articleMax,paddingHorizontal:20,paddingTop:24,paddingBottom:72},pageCompact:{paddingHorizontal:14,paddingTop:18},floatingBack:{position:"absolute",left:14,top:14,width:44,height:44,borderRadius:22,borderWidth:StyleSheet.hairlineWidth,alignItems:"center",justifyContent:"center"},floatingBackText:{fontSize:24,lineHeight:26,fontWeight:"900"},heroFrame:{width:"100%",aspectRatio:16/9,borderRadius:18,overflow:"hidden",marginBottom:28},heroImage:{width:"100%",height:"100%"},brand:{fontSize:13,fontWeight:"800",letterSpacing:2.2,marginBottom:16},eventIdentity:{marginBottom:16,gap:7},eventIdentityTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10},eventLabelRow:{flexDirection:"row",alignItems:"center",gap:8},eventLabel:{fontSize:13,fontWeight:"900",letterSpacing:2.2},eventDot:{width:5,height:5,borderRadius:3},eventLive:{fontSize:12,fontWeight:"700"},eventMeta:{flexDirection:"row",flexWrap:"wrap",gap:12},eventMetaText:{fontSize:12,fontWeight:"600"},headline:{fontSize:42,lineHeight:49,fontWeight:"900",letterSpacing:-1.1},headlineCompact:{fontSize:34,lineHeight:40,letterSpacing:-.7},standfirst:{marginTop:18,fontSize:21,lineHeight:31},standfirstCompact:{fontSize:18,lineHeight:27},translationAction:{marginTop:22,alignSelf:"flex-start"},meta:{flexDirection:"row",flexWrap:"wrap",gap:10,alignItems:"center",marginTop:18},metaText:{fontSize:13},languageBadge:{fontSize:12,fontWeight:"700"},snapshotBadge:{fontSize:12,fontWeight:"800"},actions:{flexDirection:"row",gap:10,marginTop:22},action:{paddingHorizontal:18,paddingVertical:10,borderRadius:999,borderWidth:1},actionText:{fontWeight:"800"},podcastButtonDisabled:{opacity:.6},podcastButtonText:{fontSize:14,fontWeight:"800"},briefCard:{marginTop:34,padding:24,borderRadius:18,gap:22},briefSection:{gap:7,position:"relative"},briefTitle:{fontSize:14,fontWeight:"800",letterSpacing:1,textTransform:"uppercase"},briefText:{fontSize:18,lineHeight:28},briefMissing:{fontSize:15,lineHeight:22,fontStyle:"italic"},briefRepairButton:{alignSelf:"flex-start",minHeight:40,paddingHorizontal:14,borderRadius:999,borderWidth:StyleSheet.hairlineWidth,flexDirection:"row",alignItems:"center",gap:8},briefRepairButtonText:{fontSize:13,fontWeight:"800"},briefDisclosure:{gap:7},briefDisclosurePressed:{opacity:.72},briefMore:{alignSelf:"flex-start",fontSize:13,fontWeight:"900"},briefMeasurement:{position:"absolute",left:0,right:0,top:0,opacity:0,zIndex:-1},podcastFeature:{marginTop:22,padding:16,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,gap:12},podcastFeatureCopy:{gap:4},podcastFeatureTitleRow:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8},podcastFeatureTitle:{fontSize:17,fontWeight:"900"},podcastProBadge:{fontSize:10,fontWeight:"900",letterSpacing:.8},podcastFeatureBody:{fontSize:13,lineHeight:19},podcastFeatureButton:{alignSelf:"flex-start",minHeight:40,paddingHorizontal:16,borderRadius:999,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},body:{marginTop:38,gap:24},bodyText:{fontSize:19,lineHeight:31},exploreGroup:{marginTop:42,paddingTop:26,borderTopWidth:StyleSheet.hairlineWidth},exploreTitle:{fontSize:23,fontWeight:"900",marginBottom:10},exploreRow:{borderBottomWidth:StyleSheet.hairlineWidth},exploreTrigger:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},exploreLabel:{flex:1,fontSize:16,fontWeight:"800"},exploreMetaRow:{flexDirection:"row",alignItems:"center",gap:10},exploreMeta:{fontSize:12,fontWeight:"700"},exploreArrow:{width:20,textAlign:"center",fontSize:20,fontWeight:"700"},exploreContent:{paddingBottom:18,gap:10},group:{marginTop:44,paddingTop:28,borderTopWidth:StyleSheet.hairlineWidth,gap:14},groupTitle:{fontSize:24,fontWeight:"800"},bulletRow:{flexDirection:"row",gap:10},bullet:{fontSize:18,lineHeight:27},bulletText:{flex:1,fontSize:17,lineHeight:27},source:{gap:4,paddingVertical:7},sourceName:{fontSize:16,fontWeight:"700"},sourceContribution:{fontSize:15,lineHeight:22},coverageRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:16,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth},coveragePressed:{opacity:.6},coverageCopy:{flex:1,gap:4},coverageSource:{fontSize:13,fontWeight:"800"},coverageTitle:{fontSize:16,lineHeight:22,fontWeight:"600"},coverageMeta:{fontSize:12},coverageOpen:{fontSize:12,fontWeight:"700",flexShrink:0}})