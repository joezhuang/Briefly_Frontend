import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Expo static export: opt in before hydration so mobile browser safe-area
// measurements include the gesture area from the first render.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
