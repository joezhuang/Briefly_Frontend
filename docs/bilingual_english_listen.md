# Bilingual listening (free device/browser TTS)

The **Bilingual** reading mode offers per-section and per-paragraph Listen/Stop
for the language currently being shown. Audio remains a free reading aid,
separate from generated podcasts.

## Behaviour

- On narrow/mobile layouts, Listen always follows the visible language toggle.
  If the paragraph/section shows the translation, Listen speaks the translation.
  If it shows English, Listen speaks English.
- Switching languages stops any passage already speaking before the visible
  language changes.
- On wide desktop layouts, both languages are visible at once, so each column
  has its own Listen control: translated text uses the translated locale and
  the English original uses `en-US`.
- Misaligned translated/English body structures are never paired by paragraph
  index just for audio. Each visible paragraph is spoken independently.

## Free speech engine

Briefly intentionally uses the best voice already exposed by the user's
browser or operating system instead of a paid cloud TTS API.

- Web uses the browser Web Speech API directly via
  `window.speechSynthesis`.
- iOS and Android use `expo-speech`.
- Voice discovery handles delayed browser voice availability through
  `voiceschanged`.
- Matching first respects the requested BCP-47 locale, then prefers voices
  whose metadata suggests higher naturalness: Enhanced, Natural, Neural,
  Premium or browser/system high-quality voices.
- English keeps the existing voice picker. Other displayed languages
  automatically use the highest-ranked matching free voice.
- If no stronger matching voice is available, the platform's normal voice
  for that language is used.

This path has no Briefly backend inference, no TTS API key, no generated audio
asset and no per-character charge. Voice quality therefore depends on the
voices installed/exposed by the user's OS and browser.

## Playback lifecycle

- Starting a passage stops the previous passage.
- Starting speech pauses podcast playback without clearing its queue.
- Navigation, leaving Bilingual mode, app backgrounding, or switching the
  visible language stops speech.
- Long text is chunked so browser speech does not stall on large utterances.

## Manual verification

1. Open a story with a matched translated article and English original, then
   enter Bilingual mode.
2. On mobile, leave a section in Translation and tap Listen. Confirm only the
   translated text is spoken.
3. Switch that same section to English and tap Listen. Confirm only English is
   spoken.
4. Repeat the same test on an aligned body paragraph.
5. On desktop, confirm the translated and English columns each have their own
   Listen control and each speaks only its own text.
6. On web, verify speech works after a direct click and that a Natural,
   Neural, Enhanced, Premium, Microsoft, Google or other higher-quality
   matching voice is preferred when the browser exposes one.
7. Start a podcast, then tap Listen. Confirm the podcast pauses.
8. Switch language or leave Bilingual mode during playback and confirm speech
   stops.

Run:

```bash
npx tsc --noEmit
npm run smoke:ui
npm run lint
```
