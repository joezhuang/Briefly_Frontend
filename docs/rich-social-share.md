# Briefly rich social share cards

New shares use an event-stable URL:

```text
https://briefly-news.deeplyapp.uk/s/<event_id>
```

Vercel rewrites this request to `api/share/[eventId].js`. The function fetches the
latest canonical Briefly article and returns server-rendered metadata before browser
JavaScript redirects a human visitor to the normal Expo story route.

Metadata includes:

- `og:title`
- `og:description`
- `og:image` when the story has an image or video thumbnail
- `og:url`
- `og:site_name`
- Twitter/X summary-card metadata

This lets WhatsApp, iMessage, X, Facebook, LinkedIn and similar crawlers render a
clickable image/headline preview even though the main Expo web application remains a
static SPA.

## Human destination

A person opening the short URL is redirected to:

```text
/story/<slug>?eventId=<event_id>&source=share&...
```

The canonical story remains the actual reading surface.

## Legacy compatibility

The former public hostname remains a supported alias for existing links:

```text
https://briefly-news-analysis.vercel.app/s/<event_id>
```

New shares use `https://briefly-news.deeplyapp.uk`, but the old Vercel deployment is
not removed or redirected by this change, so previously shared links continue to work.

Previously shared version URLs such as:

```text
/share/623
```

are also rewritten through the same function with `legacyVersion=1`. The function
loads that immutable article version, emits rich metadata, then redirects to the
current canonical event story.

## Cache policy

Event-based share cards cache for five minutes so evolving stories can refresh their
headline/description/image. Legacy version links cache longer because their referenced
article version is immutable.


## Reliable image delivery

The Open Graph page does not expose a third-party publisher image URL directly anymore.
When a story has an image, `og:image` points to:

```text
/api/og/<event_id>?source=event&version=<article_version_id>
```

That Vercel Function fetches the current story image or video thumbnail server-side and
serves the bytes from the Briefly domain. This improves compatibility with social
crawlers that reject hot-linked publisher/CDN images or image URLs with unusual query
parameters.

The proxy accepts only HTTP(S) image URLs coming from the canonical Briefly article,
requires an `image/*` response type, caps the image at 10 MB, and applies short CDN
caching for living events. Legacy immutable share links use the longer cache policy.


## Native app-link compatibility

Both the canonical custom domain and the legacy Vercel hostname remain declared as
native app-link hosts:

- `briefly-news.deeplyapp.uk`
- `briefly-news-analysis.vercel.app`

iOS includes both as Associated Domains and Android includes both in verified HTTPS
intent filters for `/s/`, `/story/`, and `/share/`.

Adding a new Associated Domain or Android intent-filter host changes native app
entitlements/manifest data, so users need an app build containing the new domain before
links from that domain can hand off from an in-app browser such as X to Briefly. The
legacy hostname remains supported so previously shared links continue opening the app.
