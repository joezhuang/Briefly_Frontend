import type { BrieflyLanguage } from "@/context/language";

export const experimentalLocalizationCopy: Record<
  BrieflyLanguage,
  {
    pendingTitle: string;
    pendingBody: string;
    readyTitle: string;
    readyBody: string;
  }
> = {
  en: {
    pendingTitle: "Experimental translation is being prepared",
    pendingBody:
      "Showing the English original for now. This page will update automatically when the local translation is ready.",
    readyTitle: "Experimental translation",
    readyBody:
      "This AI-generated translation may contain inaccuracies or awkward wording. Refer to the original English article for authoritative content.",
  },
  es: {
    pendingTitle: "Preparando la traducción experimental",
    pendingBody:
      "Por ahora mostramos el artículo original en inglés. Esta página se actualizará automáticamente cuando la traducción local esté lista.",
    readyTitle: "Traducción experimental",
    readyBody:
      "Esta traducción generada por IA puede contener errores o expresiones poco naturales. Consulta el artículo original en inglés como fuente autorizada.",
  },
  ja: {
    pendingTitle: "実験的な翻訳を準備しています",
    pendingBody:
      "現在は英語の原文を表示しています。ローカル翻訳の準備ができ次第、このページは自動的に更新されます。",
    readyTitle: "実験的な翻訳",
    readyBody:
      "このAI生成翻訳には誤りや不自然な表現が含まれる可能性があります。正確な内容は英語の原文を参照してください。",
  },
  "zh-CN": {
    pendingTitle: "正在准备实验性翻译",
    pendingBody:
      "目前先显示英文原文。本地翻译完成后，此页面会自动更新。",
    readyTitle: "实验性翻译",
    readyBody:
      "此 AI 生成的翻译可能包含错误或不自然的表述。权威内容请以英文原文为准。",
  },
  "zh-TW": {
    pendingTitle: "正在準備實驗性翻譯",
    pendingBody:
      "目前先顯示英文原文。本地翻譯完成後，此頁面會自動更新。",
    readyTitle: "實驗性翻譯",
    readyBody:
      "此 AI 產生的翻譯可能包含錯誤或不自然的表述。權威內容請以英文原文為準。",
  },
};
