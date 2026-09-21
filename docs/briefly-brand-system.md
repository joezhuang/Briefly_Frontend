# Briefly brand system

The production brand is the three-circle Briefly mark:

- bright blue top circle;
- deep navy lower-left circle;
- slate-blue lower-right circle;
- overlap represents multiple sources converging into one understanding.

## Runtime surfaces

The same identity is used in:

1. App header — mark + `Briefly` wordmark.
2. Generic/iOS app icon.
3. Android adaptive launcher icon and monochrome mask.
4. Web favicon.
5. Static Expo splash.
6. Animated Briefly splash/icon.
7. Feed cards when an article has no image or video thumbnail.
8. Related-story cards when no image is available.
9. Rich social-share fallback when publisher/video imagery is unavailable.

Story imagery still takes priority. The Briefly fallback appears only when the story
does not provide a usable image, including after the YouTube thumbnail fallbacks in the
share-image endpoint.

The rich-share fallback is served from the same Briefly deployment at
`/briefly-share-default.png`, removing the previous dependency on a GitHub raw image.


## Android adaptive icon spacing

The Android adaptive foreground and monochrome mark are intentionally inset to about
84% of the previous foreground scale. This gives the launcher icon more breathing room
inside Android's variable circle/squircle/rounded-square masks while leaving the iOS
icon and Android background unchanged.
