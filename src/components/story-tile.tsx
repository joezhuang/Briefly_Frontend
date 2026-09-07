import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CanonicalArticle } from "@/models/article";

type TileSize = "hero" | "secondary" | "standard";

type Props = {
  article: CanonicalArticle;
  size?: TileSize;
};

export function StoryTile({ article, size = "standard" }: Props) {
  const height = size === "hero" ? 520 : size === "secondary" ? 252 : 270;

  const headlineStyle =
    size === "hero"
      ? styles.heroHeadline
      : size === "secondary"
        ? styles.secondaryHeadline
        : styles.standardHeadline;

  return (
    <Link href={`/story/${article.slug}`} asChild>
      <Pressable style={StyleSheet.flatten([styles.tile, { height }])}>
        {article.image_url ? (
          <Image
            source={{ uri: article.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
        )}

        <View style={[StyleSheet.absoluteFill, styles.overlay]} />

        <View style={styles.content}>
          <Text style={styles.category}>
            {(article.category ?? "TOP STORY").toUpperCase()}
          </Text>

          <View style={styles.bottom}>
            <Text
              style={[styles.headline, headlineStyle]}
              numberOfLines={size === "hero" ? 4 : 3}
            >
              {article.headline}
            </Text>

            {size === "hero" && article.standfirst && (
              <Text style={styles.standfirst} numberOfLines={3}>
                {article.standfirst}
              </Text>
            )}

            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {article.sources_used.length} sources
              </Text>

              <View style={styles.arrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#252525",
  },

  imageFallback: {
    backgroundColor: "#42433F",
  },

  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.38)",
  },

  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: 22,
  },

  category: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  bottom: {
    gap: 10,
  },

  headline: {
    color: "#FFFFFF",
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  heroHeadline: {
    fontSize: 38,
    lineHeight: 43,
  },

  secondaryHeadline: {
    fontSize: 23,
    lineHeight: 27,
  },

  standardHeadline: {
    fontSize: 22,
    lineHeight: 27,
  },

  standfirst: {
    maxWidth: 620,
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    lineHeight: 23,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  meta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
  },

  arrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  arrowText: {
    color: "#FFFFFF",
    fontSize: 21,
  },
});
