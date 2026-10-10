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
- On **mobile aligned body paragraphs**, **EN ↔** next to Listen/Stop is
  itself a language-toggle button. Once the paragraph shows English, that
  button changes to the UI-localized **Translation ↔** label. Regular readers
  can still tap the paragraph to toggle; admins retain selectable paragraph
  text and use the explicit button instead. No `EN ·` marker is inserted
  into the start of the paragraph. When English text is blank, neither
  button is shown.
- On **desktop body paragraphs**, Listen is beside the English label.
  Misaligned paragraphs are never falsely paired; on narrow screens the
  English-only side retains its whole-body switch, and its per-paragraph
  switch returns to the translation rather than pretending that paragraph
  indexes correspond between languages.
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
   and Listen occupy the same heading row. In an aligned body paragraph,
   tap **EN ↔** beside Listen: only that paragraph should show English,
   and the button should change to the translated-language switch. Tap it
   again or tap the paragraph to return to the translation. There must be
   no extra `EN ·` text prepended inside the paragraph itself.
3. On wide web, verify each Listen is adjacent to its English label. On
   mobile with unaligned body structures, use the whole-body English switch;
   the control beside Listen returns to the translation. Never incorrectly
   align paragraph indexes or show Listen beside untranslated content.
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


## Web and bilingual playback

- Web playback uses the browser Web Speech API directly so speech starts inside the user's click gesture.
- iOS and Android continue to use `expo-speech`.
- In aligned bilingual mode, one Listen action reads the translated passage first and then the matching English original.
- Each segment requests a voice matching its language. The existing English voice picker still controls the English segment.
- If paragraph structures do not align, Briefly avoids inventing a bilingual speech pair; the existing per-language controls remain independent.
