import { randomUUID } from "node:crypto";

// Service team (Upwork client work) models: everything is prefixed `service` and lives in `service_*` collections, apart
// from the theme team's TeamMember / Project / TimeEntry / ChatConnection. Ids are UUID strings (not ObjectIds) so the
// rows migrated from the old Upwork Project-Management Postgres keep their ids and every reference between them.
export const uuidId = { type: String, default: () => randomUUID() } as const;

export const SERVICE_PROJECT_STATUSES = ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"] as const;
export type ServiceProjectStatus = (typeof SERVICE_PROJECT_STATUSES)[number];
export const SERVICE_CLOSED_STATUSES: readonly ServiceProjectStatus[] = ["COMPLETED", "CANCELLED", "ARCHIVED"];
export const SERVICE_PERSON_ROLES = ["BUSINESS_ANALYST", "EXECUTIVE", "BUSINESS_DEVELOPER"] as const;
export type ServicePersonRole = (typeof SERVICE_PERSON_ROLES)[number];
export const SERVICE_ENTRY_STATES = ["PARSED", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export type ServiceEntryState = (typeof SERVICE_ENTRY_STATES)[number];
