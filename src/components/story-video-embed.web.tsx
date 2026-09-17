import { createElement } from "react";

type Props = {
  src: string;
  title: string;
};

export default function StoryVideoEmbed({ src, title }: Props) {
  return createElement("iframe", {
    src,
    title,
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    allowFullScreen: true,
    style: {
      width: "100%",
      height: "100%",
      border: 0,
      background: "#252525",
      display: "block",
    },
  });
}
