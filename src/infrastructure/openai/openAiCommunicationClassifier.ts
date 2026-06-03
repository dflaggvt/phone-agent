import { z } from "zod";
import type { CommunicationClassifier, CommunicationClassificationResult } from "../../domain/topics/communicationClassifier.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export class OpenAiCommunicationClassifier implements CommunicationClassifier {
  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      timeoutMs?: number;
    }
  ) {}

  async classify(input: Parameters<CommunicationClassifier["classify"]>[0]): Promise<CommunicationClassificationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          instructions: CLASSIFIER_INSTRUCTIONS,
          input: JSON.stringify(buildClassifierInput(input)),
          text: {
            format: {
              type: "json_schema",
              name: "communication_classification",
              strict: true,
              schema: CLASSIFICATION_SCHEMA
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI classification failed with HTTP ${response.status}.`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const outputText = extractOutputText(payload);
      if (!outputText) {
        throw new Error("OpenAI classification response did not include output text.");
      }

      return toDomainResult(classificationResponseSchema.parse(JSON.parse(outputText)), input.candidateTopics);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildClassifierInput(input: Parameters<CommunicationClassifier["classify"]>[0]) {
  return {
    communication: {
      id: input.communicationItem.id,
      channel: input.communicationItem.channel,
      direction: input.communicationItem.direction,
      sourceProvider: input.communicationItem.sourceProvider,
      sender: {
        displayName: input.communicationItem.sender?.displayName ?? "",
        phoneNumber: input.communicationItem.sender?.phoneNumber ?? "",
        email: input.communicationItem.sender?.email ?? ""
      },
      occurredAt: input.communicationItem.occurredAt.toISOString(),
      summary: input.communicationItem.summary ?? "",
      transcriptText: input.communicationItem.transcriptText ?? "",
      bodyText: input.communicationItem.bodyText ?? ""
    },
    candidateTopics: input.candidateTopics.slice(0, 40).map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description ?? "",
      status: topic.status,
      communicationCount: topic.communicationItemIds.length,
      decisions: topic.decisions.slice(-8).map((decision) => decision.title),
      openQuestions: topic.openQuestions.slice(-8).map((question) => question.question),
      tasks: topic.tasks.slice(-8).map((task) => task.title)
    }))
  };
}

function toDomainResult(
  result: z.infer<typeof classificationResponseSchema>,
  candidateTopics: Parameters<CommunicationClassifier["classify"]>[0]["candidateTopics"]
): CommunicationClassificationResult {
  const topicExists = result.existingTopicThreadId.length > 0
    && candidateTopics.some((topic) => topic.id === result.existingTopicThreadId);

  return {
    topicAction: result.topicAction === "existing_topic" && !topicExists ? "no_topic" : result.topicAction,
    existingTopicThreadId: topicExists ? result.existingTopicThreadId : undefined,
    proposedTopicTitle: result.proposedTopicTitle || undefined,
    proposedTopicDescription: result.proposedTopicDescription || undefined,
    confidence: clampConfidence(result.confidence),
    reason: result.reason,
    evidence: result.evidence,
    extractedFacts: result.extractedFacts.map((fact) => ({
      text: fact.text,
      confidence: clampConfidence(fact.confidence)
    })),
    extractedTasks: result.extractedTasks.map((task) => ({
      title: task.title,
      confidence: clampConfidence(task.confidence)
    })),
    extractedDecisions: result.extractedDecisions.map((decision) => ({
      title: decision.title,
      status: decision.status,
      selectedOption: decision.selectedOption || undefined,
      confidence: clampConfidence(decision.confidence)
    })),
    extractedOpenQuestions: result.extractedOpenQuestions.map((question) => ({
      question: question.question,
      confidence: clampConfidence(question.confidence)
    }))
  };
}

function extractOutputText(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (part && typeof part === "object") {
        const record = part as Record<string, unknown>;
        if (record.type === "output_text" && typeof record.text === "string") {
          return record.text;
        }
      }
    }
  }

  return undefined;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const CLASSIFIER_INSTRUCTIONS = [
  "You classify communications into persistent real-world topic threads for Phone Agent.",
  "Return only JSON matching the schema.",
  "Prefer an existing topic when the communication clearly continues that situation.",
  "Suggest a new topic only when the communication appears to describe a durable situation, project, relationship, appointment, purchase, or workflow.",
  "Use no_topic for one-off, vague, spammy, or insufficient communications.",
  "Extract durable facts, tasks, decisions, and open questions. Keep them concise and grounded in the communication.",
  "Do not infer sensitive facts beyond the supplied text.",
  "Use evidence strings that explain the classification without quoting long transcript passages."
].join(" ");

const textItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    confidence: { type: "number" }
  },
  required: ["text", "confidence"]
};

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    topicAction: { type: "string", enum: ["existing_topic", "new_topic", "no_topic"] },
    existingTopicThreadId: { type: "string" },
    proposedTopicTitle: { type: "string" },
    proposedTopicDescription: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    extractedFacts: { type: "array", items: textItemSchema },
    extractedTasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["title", "confidence"]
      }
    },
    extractedDecisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          status: { type: "string", enum: ["made", "pending"] },
          selectedOption: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["title", "status", "selectedOption", "confidence"]
      }
    },
    extractedOpenQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["question", "confidence"]
      }
    }
  },
  required: [
    "topicAction",
    "existingTopicThreadId",
    "proposedTopicTitle",
    "proposedTopicDescription",
    "confidence",
    "reason",
    "evidence",
    "extractedFacts",
    "extractedTasks",
    "extractedDecisions",
    "extractedOpenQuestions"
  ]
};

const classificationResponseSchema = z.object({
  topicAction: z.enum(["existing_topic", "new_topic", "no_topic"]),
  existingTopicThreadId: z.string(),
  proposedTopicTitle: z.string(),
  proposedTopicDescription: z.string(),
  confidence: z.number(),
  reason: z.string(),
  evidence: z.array(z.string()),
  extractedFacts: z.array(z.object({
    text: z.string(),
    confidence: z.number()
  })),
  extractedTasks: z.array(z.object({
    title: z.string(),
    confidence: z.number()
  })),
  extractedDecisions: z.array(z.object({
    title: z.string(),
    status: z.enum(["made", "pending"]),
    selectedOption: z.string(),
    confidence: z.number()
  })),
  extractedOpenQuestions: z.array(z.object({
    question: z.string(),
    confidence: z.number()
  }))
});
