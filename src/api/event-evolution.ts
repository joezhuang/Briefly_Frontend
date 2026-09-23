import { getBrieflyJson } from "@/api/briefly";

export type EventTimelineItem = {
  id: string;
  time: string | null;
  title: string;
};

export type EventTimelineSnapshot = {
  event_id: string;
  background?: EventTimelineItem[];
  timeline: EventTimelineItem[];
  upcoming?: EventTimelineItem[];
  count: number;
  synthesis_version: number | null;
  timeline_updated_at?: string | null;
};

export function getEventTimeline(
  eventId: string,
): Promise<EventTimelineSnapshot> {
  return getBrieflyJson<EventTimelineSnapshot>(
    `/api/events/${encodeURIComponent(eventId)}/timeline`,
  );
}
