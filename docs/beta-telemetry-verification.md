# #11 Step 7 — Frontend telemetry verification

Briefly's Beta Dashboard now provides two Step 7 surfaces.

## Operations → Telemetry health

Read-only health displays:

- product analytics events in the last 24 hours;
- unique sessions in the last 24 hours;
- authenticated users represented in the last 24 hours;
- client/server errors in the last 24 hours;
- unresolved error occurrences;
- most recent analytics and error receive timestamps.

## Settings → Test-account telemetry

Admins can enter up to 20 test account emails and independently choose whether those
authenticated accounts are included in:

- product analytics;
- error monitoring.

Email matching happens on the backend against the trusted authenticated identity.
The client does not attach an email to product/error telemetry.

The setting affects new telemetry only and does not rewrite historical rows.

## Local gates

```bash
npm run lint
npm run smoke:journey
npm run smoke:ui
npm run smoke:telemetry
```

Expected telemetry result:

```text
Briefly telemetry contract: 6/6 checks passed.
```
