import type { ComponentType } from "react";

type StoryVideoEmbedProps = {
  src: string;
  title: string;
  initialTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  dom?: {
    useExpoDOMWebView?: boolean;
  };
};

declare const StoryVideoEmbed: ComponentType<StoryVideoEmbedProps>;

export default StoryVideoEmbed;
