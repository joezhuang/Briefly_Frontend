import {
  deleteBrieflyJson,
  getBrieflyJson,
  postBrieflyJson,
} from "@/api/briefly";

export type EventTimelineItem = {
  id: string;
  time: string | null;
  title: string;
  order_key?: string;
};

export type EventTimelineSnapshot = {
  event_id: string;
  background?: EventTimelineItem[];
  timeline: EventTimelineItem[];
  upcoming?: EventTimelineItem[];
  count: number;
  synthesis_version: number | null;
  timeline_updated_at?: string | null;
  ordered_timeline?: EventTimelineItem[];
  timeline_order_manual?: boolean;
  timeline_order_updated_at?: string | null;
  timeline_order_editable?: boolean;
};

export function getEventTimeline(
  eventId: string,
): Promise<EventTimelineSnapshot> {
  return getBrieflyJson<EventTimelineSnapshot>(
    `/api/events/${encodeURIComponent(eventId)}/timeline`,
  );
}


export function saveEventTimelineOrder(
  eventId: string,
  orderKeys: string[],
): Promise<{
  status: "saved";
  event_id: string;
  order_keys: string[];
  updated_at?: string | null;
}> {
  return postBrieflyJson(
    `/api/events/${encodeURIComponent(eventId)}/timeline/order`,
    { order_keys: orderKeys },
  );
}

export function resetEventTimelineOrder(
  eventId: string,
): Promise<{
  status: "reset";
  event_id: string;
  had_override: boolean;
}> {
  return deleteBrieflyJson(
    `/api/events/${encodeURIComponent(eventId)}/timeline/order`,
  );
}
