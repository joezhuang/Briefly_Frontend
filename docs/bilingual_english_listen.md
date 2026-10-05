# Bilingual English listening (device TTS)

The bilingual reader supports **per-section and per-paragraph** English playback
without generating or uploading audio. This is a free reading aid, separate from
Briefly's generated podcast analysis.

## Implementation

- `src/components/bilingual-reading.tsx` supplies the English text already
  loaded for the exact paired canonical version. Summary passages use
  `<EnglishSpeechButton>`; aligned paragraphs each get their own button.
  Mismatched paragraph structures remain unpaired; users can listen to each
  English paragraph in the English column/whole-body English view.
- `src/components/english-speech-button.tsx` renders a localized Listen/Stop
  button, including a 44-point minimum tap target. The UI language changes its
  label, **not** the English voice or source text.
- `src/context/english-speech.tsx` is a single app-wide TTS controller, using
  Expo SDK 57 `expo-speech`. It reads only the passage supplied at tap time,
  with `language: "en-US"` and rate 0.9. Starting another passage stops the
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

1. On an English/Chinese bilingual Story, tap Listen on What happened, then
   Listen on Why it matters. Only the second English passage should play.
2. In the body on a small screen, keep the Chinese paragraph visible and tap
   Listen; English audio should work without switching the visible paragraph.
3. On wide web, test the English column; when paragraph structures differ,
   make sure each English paragraph has an independent Listen button.
4. Play a podcast, then Listen to an English passage. Podcast pauses without
   losing queue/position. Resume podcast: speech stops.
5. Tap Stop, navigate away, and background the app. Voice should cease.
6. Verify free and Pro accounts have the same Listen control. The Network tab
   should show no TTS request to the Briefly backend.
7. Rebuild native iOS/Android apps after adding `expo-speech`; a JS-only OTA
   update cannot install a missing native module.

Run `npm run smoke:ui`, `npm run smoke:journey`, `npm run lint`, and
`npx tsc --noEmit` after pulling changes. The smoke checks cover wiring, not
hardware voice availability or native/background lifecycle behaviour.
