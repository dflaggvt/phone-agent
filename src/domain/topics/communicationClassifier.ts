import type {
  CommunicationItem,
  ExtractedDecision,
  ExtractedFact,
  ExtractedOpenQuestion,
  ExtractedTask
} from "../communications/communicationItem.js";
import type { TopicThread } from "./topicThread.js";

export type ClassificationTopicAction = "existing_topic" | "new_topic" | "no_topic";

export interface CommunicationClassificationResult {
  topicAction: ClassificationTopicAction;
  existingTopicThreadId?: string;
  proposedTopicTitle?: string;
  proposedTopicDescription?: string;
  confidence: number;
  reason: string;
  evidence: string[];
  extractedFacts: ExtractedFact[];
  extractedTasks: ExtractedTask[];
  extractedDecisions: ExtractedDecision[];
  extractedOpenQuestions: ExtractedOpenQuestion[];
}

export interface CommunicationClassifier {
  classify(input: {
    communicationItem: CommunicationItem;
    candidateTopics: TopicThread[];
  }): Promise<CommunicationClassificationResult>;
}
