# #11 Step 8 — Frontend automated release gate

Run:

```bash
npm run release:gate
```

This runs:

1. Expo lint;
2. the 19-check integrated user-journey source gate;
3. the cross-platform UI source gate (including floating/resumable video);
4. the telemetry source gate;
5. static validation that the new Briefly icon, adaptive icon, favicon, splash and
   rich-share fallback are still wired into the release configuration.

A pass prints:

```text
BRIEFLY FRONTEND AUTOMATED RELEASE GATE: PASS
```

This is intentionally **not** the final external-beta approval. Step 8 also requires
the real Web/iOS/Android, second-account Report, admin Hide/Restore, state-cleanup,
native-icon/splash and rich-share-preview evidence recorded for the backend release
gate.

The test-account email editor is also part of this baseline: below 640px its form row
must stack vertically and its multiline field must use the full available width.
