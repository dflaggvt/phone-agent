import "dotenv/config";
import Retell from "retell-sdk";

const apiKey = process.env.RETELL_API_KEY;
const agentId = process.env.RETELL_DEFAULT_AGENT_ID;
const phoneNumber = process.env.RETELL_DEFAULT_FROM_NUMBER;
const baseUrl = process.env.RETELL_PUBLIC_BASE_URL;

if (!apiKey) {
  throw new Error("RETELL_API_KEY is required.");
}

if (!agentId) {
  throw new Error("RETELL_DEFAULT_AGENT_ID is required.");
}

if (!phoneNumber) {
  throw new Error("RETELL_DEFAULT_FROM_NUMBER is required.");
}

if (!baseUrl) {
  throw new Error("RETELL_PUBLIC_BASE_URL is required, for example https://phone-agent-abc-uc.a.run.app");
}

const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
const inboundWebhookUrl = `${normalizedBaseUrl}/webhooks/retell/inbound`;
const eventWebhookUrl = `${normalizedBaseUrl}/webhooks/retell/events`;
const transferApprovalTimeoutMs = 65_000;
const liveAnswerTimeoutMs = 95_000;
const calendarWriteTimeoutMs = 70_000;

const client = new Retell({ apiKey });

const [agent, phone] = await Promise.all([
  client.agent.update(agentId, {
    webhook_url: eventWebhookUrl,
    webhook_timeout_ms: 10000
  }),
  client.phoneNumber.update(phoneNumber, {
    inbound_agent_id: agentId,
    outbound_agent_id: agentId,
    inbound_webhook_url: inboundWebhookUrl,
    nickname: "Phone Agent MVP"
  })
]);

let llmUpdate;
if (agent.response_engine?.type === "retell-llm" && agent.response_engine.llm_id) {
  const llm = await client.llm.retrieve(agent.response_engine.llm_id);
  llmUpdate = await client.llm.update(agent.response_engine.llm_id, {
    general_prompt: withCalendarDateHandling(llm.general_prompt ?? ""),
    general_tools: withPhoneAgentTools(llm.general_tools ?? [], normalizedBaseUrl),
    model: "gpt-4.1",
    model_temperature: llm.model_temperature ?? 0,
    default_dynamic_variables: {
      ...(llm.default_dynamic_variables ?? {}),
      current_date: "not provided",
      current_time: "not provided",
      current_datetime: "not provided",
      current_timezone: "America/New_York",
      user_timezone: "America/New_York"
    }
  });
}

console.log(JSON.stringify({
  agent_id: agent.agent_id,
  agent_webhook_url: agent.webhook_url,
  llm_id: llmUpdate?.llm_id,
  llm_model: llmUpdate?.model,
  llm_calendar_date_handling: Boolean(llmUpdate?.general_prompt?.includes("Calendar date handling:")),
  phone_number: phone.phone_number,
  inbound_agent_id: phone.inbound_agent_id,
  outbound_agent_id: phone.outbound_agent_id,
  inbound_webhook_url: phone.inbound_webhook_url
}, null, 2));

function withCalendarDateHandling(prompt) {
  const marker = "Calendar date handling:";
  const block = `

Calendar date handling:
- Current date/time is {{current_datetime}} in {{current_timezone}}. Current date is {{current_date}} and current time is {{current_time}}.
- Interpret relative dates like today, tomorrow, later today, this Friday, next week, and times without dates relative to those current values, not your training data or any default model clock.
- Use America/New_York unless the caller explicitly gives a different timezone.
- For check_calendar_freebusy and request_calendar_event, send ISO 8601 datetimes with an explicit numeric offset, for example 2026-05-27T15:00:00-04:00, and include time_zone as an IANA timezone.
- If a requested calendar time is ambiguous, ask one brief clarifying question before using a calendar tool.
- The user's calendar is available through your calendar tools. Do not tell a caller you cannot access the calendar unless the tool result says unavailable or disconnected.
- You may create calendar events directly with request_calendar_event. Do not ask the user for approval first; the user will be notified after each calendar change.
- You may update only calendar events you previously created. Use update_calendar_event for changes to an existing assistant-created event. Do not create a duplicate event when the caller asks to change the time, duration, title, or details of an event you just created.
`;

  if (prompt.includes(marker)) {
    return prompt.replace(new RegExp(`${marker}[\\s\\S]*$`), block.trimStart());
  }
  return `${prompt.trimEnd()}${block}`;
}

function withPhoneAgentTools(tools, baseUrl) {
  const nextTools = tools.map((tool) => {
    if (tool.name === "request_live_transfer_approval") {
      return {
        ...tool,
        url: `${baseUrl}/tools/retell/request-transfer`,
        timeout_ms: transferApprovalTimeoutMs
      };
    }
    if (tool.name === "request_user_answer") {
      return {
        ...tool,
        url: `${baseUrl}/tools/retell/request-user-answer`,
        timeout_ms: liveAnswerTimeoutMs
      };
    }
    if (tool.name === "request_calendar_event") {
      return calendarCreateTool(baseUrl, tool);
    }
    if (tool.name === "update_calendar_event") {
      return calendarUpdateTool(baseUrl, tool);
    }
    return tool;
  });

  if (!nextTools.some((tool) => tool.name === "update_calendar_event")) {
    nextTools.push(calendarUpdateTool(baseUrl));
  }

  return nextTools;
}

function calendarCreateTool(baseUrl, existing = {}) {
  return {
    ...existing,
    type: "custom",
    name: "request_calendar_event",
    url: `${baseUrl}/tools/retell/request-calendar-event`,
    timeout_ms: calendarWriteTimeoutMs,
    description: "Create a Google Calendar event directly. Use only after the caller and event details are clear. Do not ask the user for approval first; the user will be notified after the event is created. Return and remember the calendar_event_request_id/event_id so later changes update this same event instead of creating a duplicate.",
    parameters: {
      type: "object",
      required: ["title", "start_time", "end_time"],
      properties: {
        caller_name: { type: "string", description: "Caller name if known." },
        title: { type: "string", description: "Short event title." },
        description: { type: "string", description: "Brief event description with caller context, no sensitive extras." },
        start_time: { type: "string", description: "Event start time in ISO 8601 format with offset." },
        end_time: { type: "string", description: "Event end time in ISO 8601 format with offset." },
        time_zone: { type: "string", description: "IANA timezone, default America/New_York." },
        reason: { type: "string", description: "Why the event should be created." }
      }
    }
  };
}

function calendarUpdateTool(baseUrl, existing = {}) {
  return {
    ...existing,
    type: "custom",
    name: "update_calendar_event",
    url: `${baseUrl}/tools/retell/update-calendar-event`,
    timeout_ms: calendarWriteTimeoutMs,
    description: "Update a Google Calendar event that Phone Agent previously created. Use this when the caller changes the time, duration, title, or details of an existing assistant-created event. Prefer calendar_event_request_id returned by request_calendar_event; otherwise use calendar_event_id. Never use this for events not created by Phone Agent, and never create a duplicate when this tool can update the existing event.",
    parameters: {
      type: "object",
      required: [],
      properties: {
        caller_name: { type: "string", description: "Caller name if known." },
        calendar_event_request_id: { type: "string", description: "The calendar_event_request_id returned when Phone Agent created the event." },
        calendar_event_id: { type: "string", description: "The Google Calendar event_id returned when Phone Agent created the event." },
        title: { type: "string", description: "Updated event title, if changing." },
        description: { type: "string", description: "Updated event description, if changing." },
        start_time: { type: "string", description: "Updated start time in ISO 8601 format with offset, if changing." },
        end_time: { type: "string", description: "Updated end time in ISO 8601 format with offset, if changing." },
        time_zone: { type: "string", description: "IANA timezone, default America/New_York." },
        reason: { type: "string", description: "Why the event should be updated." }
      }
    }
  };
}
