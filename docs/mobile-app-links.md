# Briefly HTTPS story links — iOS Universal Links / Android App Links

The **existing** share URL stays stable:

```
https://briefly-news-analysis.vercel.app/s/<event-uuid>?ui=ja&content=en&read=zh-CN
```

When the production mobile app is installed and verified, the OS opens
`src/app/s/[eventId].tsx`, which routes to the existing story reader with
`source=share` and preserves `ui`, `content`, and `read`. No paid story
generation is triggered for shared recipients. Older
`/share/<article-version>` and direct `/story/<slug>?eventId=...` URLs are
also associated with the app. On a device without the app, the URL still
resolves to the web reader.

A compact **optional** chooser appears on web share pages on mobile devices.
It provides a single Open or get Briefly button and Continue on web.
On Android Chrome, the button uses an Intent URL with a Play Store fallback
for missing apps. On iOS and other browsers, Open attempts the installed-app
scheme, then uses a visibility-aware fallback to the configured store URL.
It never automatically redirects users who do not tap the Open action. The existing homepage web-app
installation banner remains unchanged. A separate, default-off runtime flag
\`mobile_app_promotion_enabled\` governs both the Home native-download banner
and the shared-story app-or-install chooser; it does not disable installed-app
Universal Links or the web app installation banner. The web article remains readable
without touching any of the chooser actions.

## 1. Native IDs and association

The native package/bundle identifier is `com.hybridgalaxy.briefly`.
`app.json` now registers:

- iOS: `applinks:briefly-news-analysis.vercel.app`.
- Android: verified `https` intent filters for `/s/`, `/share/`,
  and `/story/`.

**Do not create release builds expecting verification until both association
responses have valid production values.**

The Vercel functions expose the following paths directly (HTTP 200, JSON,
**no 301/302 redirects**):

| Device | Public URL | Production Vercel environment variable |
| --- | --- | --- |
| iOS | `/.well-known/apple-app-site-association` | `BRIEFLY_APPLE_APP_ID_PREFIX` |
| Android | `/.well-known/assetlinks.json` | `BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS` |

Obtain **`BRIEFLY_APPLE_APP_ID_PREFIX`** from the Apple Developer App ID
for `com.hybridgalaxy.briefly`. It is typically the 10-character Team ID;
verify the actual App ID prefix instead of assuming it. The server constructs
`<PREFIX>.com.hybridgalaxy.briefly`.

Obtain **`BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS`** from **Google Play
Console → Setup → App integrity → App signing key certificate → SHA-256**.
Use the **app signing** certificate, *not* the upload key SHA-256. Supply
uppercase colon-separated bytes, e.g. 32 pairs of hex bytes separated by
colons. Multiple release certificates may be separated by commas; do not add
untrusted or private debug certificates to the production association.

These values were not available in the repository. The handlers fail closed
(HTTP 503) until correct values are present; they never publish fake app IDs
or certificate fingerprints.

Set them in **Vercel → briefly-frontend → Settings → Environment Variables →
Production**, then redeploy the production frontend when ready.
Vercel function rewrites:
```
/.well-known/apple-app-site-association → /api/apple-app-site-association
/.well-known/assetlinks.json             → /api/android-assetlinks
```

## 2. Store choices (separate from website installation)

The web choice bar shares the existing store URL configuration already used
by `HomeInstallBanners`:

- `EXPO_PUBLIC_BRIEFLY_IOS_APP_URL`: verified live App Store URL once public.
- `EXPO_PUBLIC_BRIEFLY_ANDROID_APP_URL`: verified Google Play URL once public
  or available to enrolled closed-test users.

Set these in the **Vercel build environment** and redeploy so the browser
bundle has the URL. Android falls back to the official Play Store details URL constructed
from the verified application package ID when no public link is configured.
On iOS, **the exact App Store listing URL must be configured**: there is
no safe way to infer a private/unpublished iOS App Store item ID. If it is
missing, the chooser explains that the App Store link is not configured
rather than silently failing or guessing an unrelated listing.
An unconfigured iOS store URL **does not show a broken
installation button**. Until store publication, sharing and reading still
work; a closed test can only install through its eligible distribution link.
Never fabricate an App Store item ID.

On iOS Safari, tapping a Universal Link on the *same domain as the current
page* may remain in Safari by design. The explicit Open in Briefly button
uses the existing `briefly://` scheme on iOS and a guarded web-visibility
timeout to offer the configured App Store link if the app did not appear
to open. The browser cannot reliably detect installation, and this heuristic
can vary among iOS browsers. Android Chrome uses its documented `intent://`
URI with `S.browser_fallback_url` pointing to Google Play. The user must
tap the Open button; there is no forced installation or install detection. Installing the app and resuming the exact story **after the
installation** is a separate deferred deep-link feature and is not promised
by this implementation.

## 3. Build and verify

```bash
git switch main
git pull --ff-only
npx tsc --noEmit --pretty false
npm run smoke:app-links
npm run smoke:journey
npm run smoke:ui
```

Build new signed apps after configuring the verified web associations:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Check the deployed association documents, expecting **HTTP 200 directly** and
matching IDs / fingerprints:

```bash
curl -i https://briefly-news-analysis.vercel.app/.well-known/apple-app-site-association
curl -i https://briefly-news-analysis.vercel.app/.well-known/assetlinks.json
```

Then test on **real devices** with the **release-signed app**:

1. With the app installed, open a real `/s/<event-uuid>?ui=...&content=...&read=...`
   HTTPS URL from iOS Notes/Messages or Android Messages. It should open
   the Briefly story with the intended languages.
2. Remove the app, open the same URL, and verify the web article remains
   readable. The web chooser should offer Open app, Continue on web, and
   **only if the store URL is configured** the corresponding store option.
3. In Safari already browsing the Briefly website, use the explicit
   Open in Briefly option to test the same-domain case.
4. Test a historical `/share/<versionId>` URL and a
   `/story/<slug>?eventId=<uuid>` URL; inspect if they open in the app.
5. Android verification: `adb shell pm get-app-links com.hybridgalaxy.briefly`
   should report the Briefly host as verified for the Play-signed install.
6. Verify web share previews still return Open Graph tags to crawlers and
   do not initiate canonical generation.

If the association file returns 503, the environment value is absent or
invalid. If it redirects, fix the Vercel rewrite. If Android is not verified,
check the **Google Play signing certificate** rather than the upload key.
For iOS, inspect Associated Domains under Xcode Signing & Capabilities and
allow time for Apple's association cache to update.

**Not in scope:** forced installation; hidden app-installed detection;
automatic post-install return to a specific story; changing existing
homepage web-install banners; changing backend production.
