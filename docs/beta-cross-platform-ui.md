# #11 Step 6 — Cross-platform UI pass

This step hardens the same beta journey across Web, iOS and Android without creating
different product behavior per platform.

## Implemented hardening

### Sharing

Story sharing now uses one platform helper:

- iOS: native share sheet with the Briefly short URL;
- Android: native share intent with headline + short URL;
- Web: Web Share API when available;
- Web fallback: copy the short URL to the clipboard;
- final Web fallback: expose the URL in a copy prompt.

Copied links receive visible confirmation and count as a successful share.

### Mobile keyboard behavior

The Story scroll surface now keeps handled taps active while the keyboard is open.
Community type, Publish and other controls can therefore be tapped without the first
tap being consumed only to dismiss the keyboard. iOS uses interactive dismissal;
Android/other native platforms use drag dismissal.

### Briefly brand surfaces

The new three-circle Briefly mark is now shared by the app header, launcher icons,
favicon, splash, feed/related-card no-image states, and the rich-share no-image
fallback. Cards no longer fall back to an anonymous flat gray block.

### Touch targets

Core beta controls now use a minimum 44pt target where they were previously 30–40pt:
Feed actions, Story actions, Follow, Community controls, Podcast controls, Header
controls and retry states.

The feed card's source-count + enter-story arrow row is anchored to the bottom edge of
the card. Feed Share / Community / Play / Translate controls are compact 44×44
icon-only buttons with localized accessibility labels; the translation icon also
changes for translated/original/retry state. If actions ever wrap, they wrap upward,
so adding controls cannot push the story-entry arrow downward or clip it out of the
fixed-height tile.

When a feed video is playing, its media surface remains dedicated to playback controls.
A 44×44 story-entry arrow stays at the top-left of the playing card, away from the
player's own right-side controls, while the close-video control remains top-right. Opening the story therefore
never requires hijacking taps intended for play/pause, scrubbing or fullscreen.

If the user opens that story through the playing-video arrow, Home records the latest
playback time, stops its player, and passes `autoplayVideo=1&videoTime=<seconds>`.
The Story player starts from that timestamp. Normal story navigation does not set the
handoff and never autoplays.

After explicit playback starts, Home and Story both detach the inline player when its
video frame leaves the viewport and render a compact floating player at the top-right.
The latest playback time is handed to the floating player, and when the original video
frame returns to view the time is handed back to the inline player. Closing the
floating player stops that floating session. Only one Home video session is active at
a time.

Player teardown is explicit rather than relying only on React state: direct
`expo-video` playback is paused on unmount, Web YouTube/Vimeo embeds receive a
stop/pause command and their iframe is blanked, and native WebView media is paused and
blanked during teardown. Replaying the same story must therefore start only one audible
player.

## Automated gates

```bash
npm run lint
npm run smoke:journey
npm run smoke:ui
```

Expected:

```text
Briefly cross-platform UI contract: 12/12 checks passed.
```

## Manual runtime matrix

### Web

Test around 1440px, 900px and phone-width 390px.

- Header changes between full, compact and phone navigation without clipping.
- Feed actions wrap rather than overflow.
- Share opens Web Share when supported; otherwise the short link is copied.
- Coverage sources open in a new tab.
- Settings panel stays in the viewport and scrolls.
- Community actions remain readable and clickable.
- Start a Home video, scroll its card fully out of view, and confirm the floating
  player continues near the same timestamp.
- Scroll the original card back into view and confirm playback returns inline near the
  same timestamp.
- Open the same story from the playing-video arrow and confirm Story starts from the
  handed-off timestamp.
- In Story, scroll the playing hero video out of view and back again; confirm floating
  and inline playback preserve position.
- Close/navigate away from a playing video, return to that same story, press Play again,
  and confirm there is exactly one audible audio stream.

### iOS

On a phone-sized simulator/device:

- safe areas do not overlap content;
- Share opens the iOS share sheet;
- Feed/Follow/Community/Podcast controls are comfortably tappable;
- with Community body input focused, contribution type and Publish still respond;
- dragging dismisses the keyboard interactively;
- video close control remains easy to hit;
- Home and Story video floating/resume preserve playback position when scrolled away
  and back;
- opening Story from an actively playing Home video resumes from the handed-off time.

### Android

On a phone-sized emulator/device:

- narrow action rows do not clip;
- Share opens the Android share intent;
- with Community input focused, type/Publish controls still respond;
- dragging dismisses the keyboard;
- Follow/Save/Community/Podcast controls do not overlap;
- back navigation from Story returns to the previous Briefly surface when available;
- Home and Story video floating/resume preserve playback position when scrolled away
  and back;
- opening Story from an actively playing Home video resumes from the handed-off time.

## Closure gate

Step 6 closes only after lint, journey smoke, UI smoke, and one runtime pass on each of
Web, iOS and Android are green.
