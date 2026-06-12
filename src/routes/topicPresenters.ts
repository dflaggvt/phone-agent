import type { CommunicationItem, CommunicationChannel, CommunicationItemRepository } from "../domain/communications/communicationItem.js";
import type { TopicThread } from "../domain/topics/topicThread.js";

export interface TopicTimelineItemView {
  id: string;
  communicationItemId: string;
  channel: CommunicationChannel;
  channelLabel: string;
  title: string;
  summary: string;
  occurredAt: string;
  senderName: string;
}

export type TopicThreadView = TopicThread & {
  communicationCount: number;
  timeline: TopicTimelineItemView[];
};

export async function presentTopicThreads(input: {
  topics: TopicThread[];
  communicationItems: CommunicationItemRepository;
  userId: string;
  timelineLimit?: number;
}): Promise<TopicThreadView[]> {
  const ids = input.topics.flatMap((topic) => topic.communicationItemIds);
  const items = await input.communicationItems.listByIdsForUser(input.userId, ids);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const timelineLimit = input.timelineLimit ?? 8;

  return input.topics.map((topic) => {
    const timeline = topic.communicationItemIds
      .map((id) => itemById.get(id))
      .filter((item): item is CommunicationItem => item !== undefined)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, timelineLimit)
      .map(presentTopicTimelineItem);

    return {
      ...topic,
      communicationCount: topic.communicationItemIds.length,
      timeline
    };
  });
}

function presentTopicTimelineItem(item: CommunicationItem): TopicTimelineItemView {
  const channelLabel = communicationChannelLabel(item.channel);
  const senderName = item.sender?.displayName || item.sender?.phoneNumber || "Unknown";
  return {
    id: item.id,
    communicationItemId: item.id,
    channel: item.channel,
    channelLabel,
    title: item.channel === "phone_call" ? `Call from ${senderName}` : `${channelLabel} from ${senderName}`,
    summary: compactTimelineText(item.summary || item.bodyText || item.transcriptText || "No summary is available yet."),
    occurredAt: item.occurredAt.toISOString(),
    senderName
  };
}

function communicationChannelLabel(channel: CommunicationChannel): string {
  switch (channel) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "calendar_event":
      return "Calendar";
    case "document":
      return "Document";
    case "manual_note":
      return "Note";
    case "agent_message":
      return "Agent message";
    case "phone_call":
    default:
      return "Call";
  }
}

function compactTimelineText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237).trimEnd()}...` : normalized;
}
