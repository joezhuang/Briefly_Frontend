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
A separate 44×44 story-entry arrow stays available at the top-left of the playing
card, while the close-video control remains top-right. Opening the story therefore
never requires hijacking taps intended for play/pause, scrubbing or fullscreen.

## Automated gates

```bash
npm run lint
npm run smoke:journey
npm run smoke:ui
```

Expected:

```text
Briefly cross-platform UI contract: 8/8 checks passed.
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

### iOS

On a phone-sized simulator/device:

- safe areas do not overlap content;
- Share opens the iOS share sheet;
- Feed/Follow/Community/Podcast controls are comfortably tappable;
- with Community body input focused, contribution type and Publish still respond;
- dragging dismisses the keyboard interactively;
- video close control remains easy to hit.

### Android

On a phone-sized emulator/device:

- narrow action rows do not clip;
- Share opens the Android share intent;
- with Community input focused, type/Publish controls still respond;
- dragging dismisses the keyboard;
- Follow/Save/Community/Podcast controls do not overlap;
- back navigation from Story returns to the previous Briefly surface when available.

## Closure gate

Step 6 closes only after lint, journey smoke, UI smoke, and one runtime pass on each of
Web, iOS and Android are green.
