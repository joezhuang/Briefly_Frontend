import { Platform, Share } from "react-native";

export type BrieflyShareResult = "shared" | "copied" | "dismissed";

type BrieflyShareInput = {
  headline: string;
  url: string;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String((error as { name?: unknown }).name) === "AbortError"
  );
}

export async function shareBrieflyStory({
  headline,
  url,
}: BrieflyShareInput): Promise<BrieflyShareResult> {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: headline, text: headline, url });
        return "shared";
      } catch (error) {
        if (isAbortError(error)) return "dismissed";
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }

    if (typeof window !== "undefined") {
      window.prompt("Copy this Briefly link:", url);
      return "copied";
    }
  }

  const result = await Share.share(
    Platform.OS === "ios"
      ? { message: headline, url }
      : { message: `${headline}\n${url}` },
  );

  return result.action === Share.dismissedAction ? "dismissed" : "shared";
}
