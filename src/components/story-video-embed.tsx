'use dom';

export default function StoryVideoEmbed({ src, title }: { src: string; title: string; dom?: import('expo/dom').DOMProps }) {
  return (
    <iframe
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        width: '100%',
        height: '100%',
        border: 0,
        background: '#252525',
        display: 'block',
      }}
    />
  );
}
