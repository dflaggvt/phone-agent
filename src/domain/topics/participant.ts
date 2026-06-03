export type ParticipantKind = "person" | "organization" | "agent" | "system";

export type TopicParticipantRole = "owner" | "participant" | "viewer" | "contributor" | "external_agent";

export interface Participant {
  id: string;
  userId: string;
  kind: ParticipantKind;
  displayName: string;
  contactId?: string;
  phoneNumber?: string;
  email?: string;
  organization?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicParticipant {
  participantId: string;
  role: TopicParticipantRole;
  addedAt: Date;
  permissions: TopicPermission[];
}

export type TopicPermission =
  | "read_thread_summary"
  | "read_selected_artifacts"
  | "comment"
  | "add_communication"
  | "complete_task"
  | "answer_question"
  | "approve_decision"
  | "agent_message";

