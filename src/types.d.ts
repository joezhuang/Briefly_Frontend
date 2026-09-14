declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '@/components/home-ad-slot' {
  export function HomeAdSlot(): import('react').ReactElement | null;
}

declare module '@/components/story-ad-slot' {
  export function StoryAdSlot(): import('react').ReactElement | null;
}
