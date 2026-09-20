# #11 Step 2 — Beta user-journey smoke test

This is the runtime smoke test for the integrated Briefly beta journey:

```text
Feed → Story → Lens → Source → Follow → Save → Podcast → Community → Reaction → Report
                                                       ↓
                                             Admin moderation
```

The source-level contract gate is:

```bash
npm run smoke:journey
```

It does not replace device testing. It prevents a later refactor from silently removing or
disconnecting one of the journey surfaces before the manual smoke pass is run.

## Preconditions

Use the current FE `main` and the backend soak environment running
`feature/community-v0.1`.

Prepare:

- one normal signed-in beta account;
- one Briefly Pro account for podcast generation/playback;
- a second normal account for the Report step, because users should not report their own contribution;
- one admin account for the moderation queue;
- one current event with a canonical story, evidence/intelligence and at least one source URL.

For iOS and Android, test an installed build rather than only Expo web.

## Platform matrix

Record each row as PASS / FAIL / N/A. A Step 2 release gate requires Web, iOS and
Android to pass the core journey.

| Step | Web | iOS | Android | Expected result |
| --- | --- | --- | --- | --- |
| Feed |  |  |  | Feed loads without a blocking error; story tiles render and pagination/refresh remain usable. |
| Story |  |  |  | Tapping a tile opens the same canonical event/story, with no `Story unavailable` error. |
| Lens |  |  |  | Evidence / Timeline / Coverage tabs are usable; changing tabs does not lose the story. |
| Source |  |  |  | Opening a source launches a new browser tab on web or the external browser on native. |
| Follow |  |  |  | Signed-out action returns through sign-in; signed-in action toggles Follow ↔ Following and Following screen is reachable. |
| Save |  |  |  | Save toggles immediately; Saved screen contains the snapshot; unsave removes it. |
| Podcast |  |  |  | Signed-out users are sent to sign-in, free users to upgrade, Pro users can request/status-check/play a ready podcast. |
| Community |  |  |  | Public contributions load; signed-out Contribute sends the user to sign-in; signed-in account can publish a valid contribution. |
| Reaction |  |  |  | 👍/👎 updates once; same reaction again cancels; opposite reaction switches. |
| Report |  |  |  | A second account can report a visible contribution once using a controlled reason. |
| Moderation |  |  |  | Admin Operations → Community moderation shows the report; Hide removes it from public Community; Restore makes it visible again. |

## Detailed pass

### 1. Feed → Story

1. Launch Briefly from a cold start.
2. Confirm the feed is usable.
3. Open a current story tile.
4. Confirm the URL/deep link carries the canonical event identity.
5. Back navigation returns to Briefly rather than stranding the user externally.

Pass if the story resolves consistently and no stale-route 404 is shown.

### 2. Story → Lens → Source

1. On the story, locate the event intelligence lenses.
2. Switch Evidence → Timeline → Coverage → Evidence.
3. In Coverage, open one original source.
4. Return to Briefly.

Pass if every lens remains scoped to the same event and the original source opens
without replacing/corrupting the Briefly story state.

### 3. Follow

Test once signed out and once signed in.

Signed out:

1. Tap Follow event.
2. Sign in.
3. Confirm the return path restores the story.

Signed in:

1. Toggle Follow on.
2. Open Following / Updates.
3. Return to the story.
4. Toggle Follow off, then back on if the event is part of the soak scenario.

Pass if UI state rolls back cleanly on an API failure and never shows a false followed
state.

### 4. Save

Briefly's current story Save is a **device-local saved snapshot**, not the backend
`saved_events` table.

1. Save the story.
2. Open Saved.
3. Open the saved snapshot.
4. Unsave it.
5. Confirm it disappears from Saved.

Repeat on each platform because persistence is platform/device-local.

### 5. Podcast

Use a canonical article with a valid `article_version_id`.

1. Signed out: action routes to sign-in.
2. Signed-in free account: action routes to Upgrade.
3. Pro account: request podcast analysis if one does not exist.
4. While processing, leave and return to the story.
5. When ready, start playback and confirm the inline/global player behaves normally.

Do not repeatedly regenerate the same podcast just to smoke test. Reuse a ready podcast
where possible.

### 6. Community → Reaction

1. Read Community while signed out.
2. Tap Contribute and verify sign-in routing.
3. Sign in and create a short **test Perspective** clearly labelled as smoke-test content.
4. Confirm it appears as `You`.
5. Tap 👍.
6. Tap 👍 again and confirm cancellation.
7. Tap 👎, then 👍 and confirm switching.
8. Leave the contribution visible for the Report step.

### 7. Report

Use the second non-admin account.

1. Open the same event.
2. Find the smoke-test contribution.
3. Report it with a controlled reason such as `other`.
4. Attempting the same report again must not create a duplicate report.

Do not report real user content for smoke testing.

### 8. Admin moderation

Use the admin account.

1. Open Beta Dashboard → Operations.
2. Refresh Community moderation.
3. Confirm the smoke-test contribution appears without author/reporter account identity.
4. Hide it.
5. Verify it disappears from the public Community list.
6. Restore it.
7. Verify it returns.
8. Sign back into the owner account and withdraw the smoke-test contribution.

This leaves no visible smoke-test contribution behind. The report/moderation audit row
may remain by design.

## Failure capture

For every failure record:

- platform and app version;
- event ID and article version ID;
- exact journey step;
- HTTP status/error text if shown;
- whether retry/reload recovered;
- whether local UI state became inconsistent.

Do not paste access tokens, email addresses, contribution bodies, or private source URLs
into bug reports or analytics.

## Step 2 completion gate

Step 2 is closed only when:

1. `npm run lint` passes;
2. `npm run smoke:journey` passes;
3. the backend Step 2 pytest set passes;
4. Web, iOS and Android complete the core matrix;
5. admin Hide → public disappearance → Restore is verified;
6. no test leaves a false Follow/Save/Reaction state behind.
