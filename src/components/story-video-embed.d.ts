import type { ComponentType } from "react";

type StoryVideoEmbedProps = {
  src: string;
  title: string;
  dom?: {
    useExpoDOMWebView?: boolean;
  };
};

declare const StoryVideoEmbed: ComponentType<StoryVideoEmbedProps>;

export default StoryVideoEmbed;
