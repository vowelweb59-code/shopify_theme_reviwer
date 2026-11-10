import { Schema, model, models, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// The TIMER STATUS space (hours come only from it) and registered client spaces (never read for hours).
const serviceChatSpaceSchema = new Schema(
  {
    _id: uuidId,
    externalId: { type: String, required: true, unique: true }, // spaces/AAAA...
    name: { type: String, required: true },
    type: { type: String, enum: ["TIMER_STATUS", "CLIENT_PROJECT"], required: true },
    clientId: { type: String, default: null },
  },
  { timestamps: true, collection: "service_chat_spaces" }
);

// A person who posts in TIMER STATUS. Unmatched senders keep their hours; matching only links them to a ServiceUser.
// The profile (designation, team, salary) lives here because the team are senders, not users.
const serviceChatSenderSchema = new Schema(
  {
    _id: uuidId,
    externalId: { type: String, required: true, unique: true }, // users/123
    displayName: { type: String, required: true },
    userId: { type: String, default: null },
    matchedBy: { type: String, enum: ["NAME", "MANUAL", null], default: null },
    designation: { type: String, default: null },
    team: { type: String, default: null },
    salaryMonthlyMinor: { type: Number, default: null },
    salaryCurrency: { type: String, default: "INR" },
  },
  { timestamps: true, collection: "service_chat_senders" }
);

// The message as received. Dedupe key: space + Chat message id; an edited message replaces its own entries.
const serviceChatMessageSchema = new Schema(
  {
    _id: uuidId,
    spaceId: { type: String, required: true },
    externalId: { type: String, required: true },
    senderExternalId: { type: String, required: true },
    senderName: { type: String, required: true },
    userId: { type: String, default: null },
    postedAt: { type: Date, required: true, index: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ["TIMER", "MANUAL_REPORT", "TIMER_AND_REPORT", "IGNORED", "UNRECOGNIZED"], required: true },
    parserVersion: { type: String, required: true },
  },
  { timestamps: true, collection: "service_chat_messages" }
);
serviceChatMessageSchema.index({ spaceId: 1, externalId: 1 }, { unique: true });

// Month-scoped import progress per space (IST "YYYY-MM").
const serviceSyncCheckpointSchema = new Schema(
  { spaceId: { type: String, required: true }, month: { type: String, required: true }, completedAt: { type: Date, default: null } },
  { timestamps: true, collection: "service_sync_checkpoints" }
);
serviceSyncCheckpointSchema.index({ spaceId: 1, month: 1 }, { unique: true });

// The Google account TIMER STATUS is read as: its own singleton, separate from the theme team's ChatConnection.
// The refresh token is encrypted (lib/analytics/crypto.ts) and select: false.
const serviceChatConnectionSchema = new Schema(
  {
    key: { type: String, required: true, default: "service-chat", unique: true },
    googleAccountId: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    encryptedRefreshToken: { type: String, default: null, select: false },
    scopes: { type: [String], default: () => [] },
    lastSyncAt: { type: Date, default: null },
    lastResult: { type: Schema.Types.Mixed, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "service_chat_connection" }
);

export type ServiceChatSpaceDoc = InferSchemaType<typeof serviceChatSpaceSchema>;
export type ServiceChatSenderDoc = InferSchemaType<typeof serviceChatSenderSchema>;
export type ServiceChatMessageDoc = InferSchemaType<typeof serviceChatMessageSchema>;
export const ServiceChatSpace = models.ServiceChatSpace ?? model("ServiceChatSpace", serviceChatSpaceSchema);
export const ServiceChatSender = models.ServiceChatSender ?? model("ServiceChatSender", serviceChatSenderSchema);
export const ServiceChatMessage = models.ServiceChatMessage ?? model("ServiceChatMessage", serviceChatMessageSchema);
export const ServiceSyncCheckpoint = models.ServiceSyncCheckpoint ?? model("ServiceSyncCheckpoint", serviceSyncCheckpointSchema);
export const ServiceChatConnection = models.ServiceChatConnection ?? model("ServiceChatConnection", serviceChatConnectionSchema);
