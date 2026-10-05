# Bilingual English listening (device TTS)

The **Bilingual** reading mode offers per-section and per-paragraph English
Listen/Stop when an exact-version English original is available. English-only
and translated-only views do **not** display speech buttons or the voice
picker. Audio remains a free reading aid, separate from generated podcasts.

## Visibility and placement

- `src/app/story/[slug].tsx` passes `bilingualOriginal` only when the
  user has selected Bilingual and `matchedBilingualOriginal` has verified
  the event and exact English source version. Without that match, the reader
  falls back to its regular English/translated view with **no Listen controls**.
- `src/components/article-view.tsx` renders ordinary article text outside
  Bilingual mode. Do not reintroduce a separate `englishSpeechSource` prop:
  it previously exposed buttons in English-only and translated-only modes.
- On **mobile summary sections**, Listen/Stop is in the same heading row as
  the English/Translation switch. On **desktop**, it is immediately beside
  the English-original label.
- On **mobile body paragraphs**, Listen/Stop is beside an **EN** indicator
  in the paragraph's control row. The paragraph text can still be tapped to
  compare languages. On **desktop body paragraphs**, it is next to the
  English label. Misaligned paragraphs are never falsely paired; the English
  originals have their own listen controls only when displayed.
- `EnglishVoicePicker` appears only within Bilingual mode when the device
  provides multiple English voices. Leaving Bilingual mode stops any speech.

## Audio architecture

- `src/components/english-speech-button.tsx` renders localized Listen/Stop
  controls with 44-point minimum tap targets. Changing the UI language only
  changes these labels, not the English text being spoken.
- `src/context/english-speech.tsx` provides one app-wide `expo-speech`
  controller (Expo SDK 57). It reads only text that is already present in the
  reader, at English locale `en-US`, rate 1.0. Better-sounding installed
  voices are preferred; users can choose a different voice, saved locally.
  Web speech is chunked to avoid browser long-utterance stalls.
- The controller stops any previous passage before starting another, pauses
  the podcast without clearing its queue, and stops on navigation, switching
  out of Bilingual mode, or app backgrounding.

Playback is free for Free and Pro readers when Bilingual mode and the cached
English source are available: **no model inference, backend endpoint, cloud
TTS service, or generated audio asset** is involved. Voice quality depends
on the installed OS/browser voice library. For physical iOS devices, check
the silent switch if sound is muted.

## Future languages

The speech controller accepts a BCP-47 language rather than assuming the
UI language. It could later support a Japanese UI user listening to Chinese
(`zh-CN`) without expanding Briefly into a language-learning product.
This release exposes only English listening in Bilingual mode.

## Manual verification

1. Open an existing approved translated article with a matched English
   original. Switch between English, Translated, and Bilingual modes. The
   speaker buttons and voice picker should appear **only in Bilingual**.
2. On a narrow phone, verify each summary's English/Translation switch
   and Listen occupy the same heading row. In body paragraphs, Listen sits
   beside EN and works even while the translation is displayed.
3. On wide web, verify each Listen is adjacent to its English label. For
   unaligned bodies, do not display a button next to a translated paragraph.
4. Tap two passages in sequence; the second should stop the first. Leave
   Bilingual mode while audio is playing; speech should stop.
5. Start a podcast and then Listen. Podcast pauses without losing its
   queue. Resume the podcast; speech stops.
6. On web, choose a different available English voice and confirm the choice
   persists on re-opening a story. Browser/OS voices determine quality.
7. Verify the existing Free and Pro access rules are unchanged. No speech
   request should reach Briefly's backend.

Run `npm run smoke:ui`, `npm run smoke:journey`,
`npm run lint`, and `npx tsc --noEmit` after pulling changes.
Device speech needs an app binary with `expo-speech`; an OTA update cannot
install a missing native module. Changing button placement alone requires
no further native rebuild if the module is already installed.
