/** Always review charts within the real story reader, not a second preview. */
export function chartReviewStoryHref(eventId: string): string {
  const value = encodeURIComponent(eventId);
  // A story route can load its canonical article by event ID independently
  // of its slug; keeping both values allows this link from the admin queue.
  return `/story/${value}?eventId=${value}&content=en&ui=en&chartReview=1`;
}
