# Bilingual English listening (device TTS)

The Story reader supports **per-section and per-paragraph** English playback
in English-only, translated-only, and bilingual modes without generating or
uploading audio. This is a free reading aid, separate from
Briefly's generated podcast analysis.

## Implementation

- `src/components/bilingual-reading.tsx` supplies English text already
  loaded for the exact paired canonical version. Summary passages and
  aligned paragraphs each get a `<EnglishSpeechButton>`.
- `src/app/story/[slug].tsx` also passes a verified English speech source to
  `src/components/article-view.tsx` in **English-only and translated-only**
  reading modes. When two languages' paragraph layouts differ, spoken English
  appears in a separate original list, never attached to the wrong translation.
- `src/components/english-speech-button.tsx` renders localized Listen/Stop
  controls with 44-point minimum tap targets and an English voice selector
  when multiple voices are installed. The UI language changes labels,
  **not** the English source text.
- `src/context/english-speech.tsx` is a single app-wide TTS controller, using
  Expo SDK 57 `expo-speech`. It reads only the passage supplied at tap time,
  with `language: "en-US"` and rate 1.0. The controller prefers available
  high-quality English voices where supported and remembers the user's
  selected voice through AsyncStorage. Web utterances are chunked to avoid
  browser long-speech stalls; no external web TTS service is used. Starting another passage stops the
  previous utterance and queue. Long paragraphs are spoken in bounded chunks.
  Speech stops on page navigation or when the app backgrounds.
- The controller pauses the podcast via `pauseForSpeech` without clearing the
  podcast queue. If the podcast resumes, English speech stops.

This is available to Free and Pro readers with bilingual content; **no backend
route, cloud TTS provider, subscription entitlement, or paid model call** is
involved. Do not add TTS output to the podcast queue or persist generated
speech files. Device voices vary by OS; on a physical iPhone the silent switch
may mute `expo-speech`.

## Scope and future languages

The controller accepts an explicit BCP-47 voice locale rather than guessing
from the UI language. For example, a Japanese UI user reading a cached
Chinese translation could eventually choose Chinese speech (`zh-CN`) while
retaining English comparison. This first release exposes only English
Listen/Stop: vocabulary practice and pronunciation scoring are out of scope.

## Manual checks

1. On the same story, test Listen in **English**, **Translated**, and
   **Bilingual** reading modes on an actual native build. Tap What happened,
   then Why it matters. Only the second English passage should play.
2. In the body on a small screen, keep the Chinese paragraph visible and tap
   Listen; English audio should work without switching the visible paragraph.
3. On wide web, test the English column; when paragraph structures differ,
   make sure each English paragraph has an independent Listen button.
4. If the browser exposes multiple English voices, switch the voice and
   replay a paragraph. Voice selection must persist across story opens.
5. Play a podcast, then Listen to an English passage. Podcast pauses without
   losing queue/position. Resume podcast: speech stops.
6. Tap Stop, navigate away, and background the app. Voice should cease.
7. Verify free and Pro accounts have the same Listen control. The Network tab
   should show no TTS request to the Briefly backend.
8. **A native app with no Listen buttons may be an old installed binary.**
   Rebuild/reinstall iOS/Android after adding `expo-speech`; an OTA update
   cannot install a missing native module. On web, voice quality is limited
   to voices that the OS/browser exposes; select another installed voice or
   install an enhanced system voice if the available voices sound robotic.

Run `npm run smoke:ui`, `npm run smoke:journey`, `npm run lint`, and
`npx tsc --noEmit` after pulling changes. The smoke checks cover wiring, not
hardware voice availability or native/background lifecycle behaviour.
