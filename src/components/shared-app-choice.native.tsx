// Installed mobile apps already show the requested story, so no web chooser.
export function SharedAppChoice(_props: {
  appPath: string;
  uiLanguage?: string | null;
  contentLanguage?: string | null;
  readingLanguage?: string | null;
}) {
  return null;
}
