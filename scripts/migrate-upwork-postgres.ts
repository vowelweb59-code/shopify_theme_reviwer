import pg from "pg";
import type { Model } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { ServiceAuditLog } from "@/models/service-audit-log";
import { ServiceChatMessage, ServiceChatSender, ServiceChatSpace, ServiceSyncCheckpoint } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceDepartment } from "@/models/service-department";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkAccount, ServiceUpworkContract, ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";

// One-off copy of the old Upwork Project-Management Postgres database into the Service section's `service_*` collections.
// Ids are kept (UUID strings), so every reference survives. The one-contract-per-project table folds into its project, and an
// entry's contract becomes its project. Sessions, role grants and handovers are not copied (one shared login here).
//
// A dry run by default: reads everything and prints the counts. --apply writes; it refuses when service collections already
// hold data unless --replace is given (which empties them first). The Google Chat connection is not copied: reconnect on
// Service > Chat sync. Source: UPWORK_DATABASE_URL (the old app's DATABASE_URL, in its apps/api/.env); target: MONGODB_URI
// from the env file given.
//   UPWORK_DATABASE_URL=postgresql://... npx tsx --env-file=.env.local scripts/migrate-upwork-postgres.ts
//   UPWORK_DATABASE_URL=postgresql://... npx tsx --env-file=.env.local scripts/migrate-upwork-postgres.ts --apply [--replace]
const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const SOURCE = process.env.UPWORK_DATABASE_URL ?? "";
if (!SOURCE) {
  console.error("Set UPWORK_DATABASE_URL to the old Upwork app's Postgres (its apps/api/.env DATABASE_URL).");
  process.exit(1);
}

// DATE columns as "YYYY-MM-DD" (pg would build a local-midnight Date, a day early east of UTC); numerics as strings.
pg.types.setTypeParser(1082, (v: string) => v);
const day = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`) : null);
const num = (v: string | number | null) => (v === null || v === undefined ? null : Number(v));

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function main() {
  const client = new pg.Pool({ connectionString: SOURCE, max: 4 });

  const q = async (sql: string) => (await client.query(sql)).rows as Row[];

  const [users, clients, accounts, profiles, projects, contracts, people, assignments, history, departments, spaces, senders, checkpoints, upworkContracts, allocations, audit] = await Promise.all([
    q(`select * from "user"`), q(`select * from client`), q(`select * from upwork_account`), q(`select * from upwork_profile`), q(`select * from project`), q(`select * from contract`),
    q(`select * from project_person`), q(`select * from project_assignment`), q(`select * from project_status_history order by at`), q(`select * from department`),
    q(`select * from chat_space`), q(`select * from chat_sender`), q(`select * from sync_checkpoint`), q(`select * from upwork_contract`), q(`select * from entry_allocation`), q(`select * from audit_log order by id`),
  ]);
  const messages = await q(`select * from chat_message`);
  const entries = await q(`select * from time_entry`);
  await client.end();

  const contractProject = new Map(contracts.map((c) => [c.id, c.project_id as string]));
  const contractByProject = new Map(contracts.map((c) => [c.project_id as string, c]));
  const group = <T extends Row>(rows: T[], key: string) => rows.reduce((m, r) => m.set(r[key], [...(m.get(r[key]) ?? []), r]), new Map<string, T[]>());
  const peopleBy = group(people, "project_id");
  const assignBy = group(assignments, "project_id");
  const historyBy = group(history, "project_id");
  const allocBy = group(allocations, "entry_id");
  const senderOfMessage = new Map(messages.map((m) => [m.id, m.sender_external_id as string]));

  const docs: Array<[Model<any>, string, Row[]]> = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    [ServiceUser, "users", users.map((u) => ({ _id: u.id, email: u.email, displayName: u.display_name, kind: u.kind, active: u.active, createdAt: u.created_at, updatedAt: u.created_at }))],
    [ServiceClient, "clients", clients.map((c) => ({ _id: c.id, name: c.name, aliases: c.aliases ?? [], inHouse: c.in_house, splitUnclear: c.split_unclear }))],
    [ServiceUpworkAccount, "Upwork accounts", accounts.map((a) => ({ _id: a.id, name: a.name }))],
    [ServiceUpworkProfile, "Upwork profiles", profiles.map((p) => ({ _id: p.id, name: p.name, aliases: p.aliases ?? [], accountId: p.account_id, createdAt: p.created_at, updatedAt: p.created_at }))],
    [ServiceProject, "projects", projects.map((p) => {
      const c = contractByProject.get(p.id);
      return {
        _id: p.id, name: p.name, clientId: p.client_id, upworkAccountId: p.upwork_account_id, upworkProfileId: p.upwork_profile_id, chatKeywords: p.chat_keywords ?? [], inHouse: p.in_house,
        reviewRating: num(p.review_rating), reviewComment: p.review_comment, reviewedAt: p.reviewed_at, contractRef: p.contract_ref, description: p.description, projectType: p.project_type,
        status: p.status, startDate: day(p.start_date), targetDate: day(p.target_date), revisedDate: day(p.revised_date), createdAt: p.created_at, updatedAt: p.created_at,
        people: (peopleBy.get(p.id) ?? []).map((x) => ({ role: x.role, name: x.name, senderId: x.sender_id })),
        assignments: (assignBy.get(p.id) ?? []).map((a) => ({ userId: a.user_id, role: a.assignment_role })),
        history: (historyBy.get(p.id) ?? []).map((h) => ({ fromStatus: h.from_status, toStatus: h.to_status, reason: h.reason, at: h.at })),
        contract: c ? { externalRef: c.external_ref, type: c.type, weeklyLimitMinutes: c.weekly_limit_minutes, hourlyRateCents: c.hourly_rate_cents, fixedPriceCents: c.fixed_price_cents, trackingMode: c.tracking_mode, startDate: day(c.start_date), endDate: day(c.end_date), status: c.status } : null,
      };
    })],
    [ServiceDepartment, "departments", departments.map((d) => ({ _id: d.id, name: d.name, isDefault: d.is_default, managerUserId: d.manager_user_id, createdAt: d.created_at, updatedAt: d.created_at }))],
    [ServiceChatSpace, "Chat spaces", spaces.map((s) => ({ _id: s.id, externalId: s.external_id, name: s.name, type: s.type, clientId: s.client_id, createdAt: s.created_at, updatedAt: s.created_at }))],
    [ServiceChatSender, "Chat senders", senders.map((s) => ({ _id: s.id, externalId: s.external_id, displayName: s.display_name, userId: s.user_id, matchedBy: s.matched_by, designation: s.designation, team: s.team, salaryMonthlyMinor: s.salary_monthly_minor, salaryCurrency: s.salary_currency, createdAt: s.created_at, updatedAt: s.created_at }))],
    [ServiceChatMessage, "Chat messages", messages.map((m) => ({ _id: m.id, spaceId: m.space_id, externalId: m.external_id, senderExternalId: m.sender_external_id, senderName: m.sender_name, userId: m.user_id, postedAt: m.posted_at, text: m.text, kind: m.kind, parserVersion: m.parser_version, createdAt: m.imported_at, updatedAt: m.imported_at }))],
    [ServiceSyncCheckpoint, "sync checkpoints", checkpoints.map((c) => ({ spaceId: c.space_id, month: c.month, completedAt: c.completed_at, createdAt: c.updated_at, updatedAt: c.updated_at }))],
    [ServiceTimeEntry, "time entries", entries.map((e) => ({
      _id: e.id, userId: e.user_id, senderExternalId: senderOfMessage.get(e.source_message_id) ?? "unknown", profile: e.profile, clientRaw: e.client_raw, profileId: e.profile_id, ordinal: e.ordinal, clientId: e.client_id,
      projectId: e.contract_id ? contractProject.get(e.contract_id) ?? null : null,
      allocations: (allocBy.get(e.id) ?? []).map((a) => ({ projectId: contractProject.get(a.contract_id)!, minutes: a.minutes })).filter((a) => a.projectId),
      entryDate: day(e.entry_date), minutes: e.minutes, source: e.source, state: e.state, flags: e.flags ?? [], notes: e.notes ?? [], memo: e.memo, reportedOnTimerMinutes: e.reported_on_timer_minutes,
      reconciliation: e.reconciliation, isLate: e.is_late, parserVersion: e.parser_version, startMessageId: e.start_message_id, sourceMessageId: e.source_message_id, createdAt: e.created_at, updatedAt: e.created_at,
    }))],
    [ServiceUpworkContract, "Upwork contract list rows", upworkContracts.map((c) => ({
      _id: c.id, sheetRef: c.sheet_ref, clientId: c.client_id, projectId: c.project_id, clientName: c.client_name, profile: c.profile, bde: c.bde, ba: c.ba, url: c.url, endedBy: c.ended_by,
      startDate: day(c.start_date), endDate: day(c.end_date), finalRating: num(c.final_rating), changedRating: num(c.changed_rating), duration: c.duration, createdAt: c.created_at, updatedAt: c.created_at,
    }))],
    [ServiceAuditLog, "audit log rows", audit.map((a) => ({ seq: Number(a.id), actorId: a.actor_id, action: a.action, detail: a.detail ?? {}, at: a.at, prevHash: a.prev_hash, hash: a.hash }))],
  ];

  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name} (source ${SOURCE.replace(/:[^:@/]+@/, ":***@")})\n`);
  for (const [, label, rows] of docs) console.log(`  ${String(rows.length).padStart(6)} ${label}`);
  const lostAllocations = allocations.filter((a) => !contractProject.has(a.contract_id)).length;
  if (lostAllocations) console.log(`\n  ${lostAllocations} allocation(s) point at a missing contract and are dropped.`);
  if (!apply) return console.log("\nDry run: nothing written. Pass --apply to copy.");

  const existing = (await Promise.all(docs.map(([m]) => m.estimatedDocumentCount()))).reduce((a, b) => a + b, 0);
  if (existing > 0 && !replace) throw new Error(`The service collections already hold ${existing} documents. Pass --replace to empty them and copy again.`);
  for (const [model, label, rows] of docs) {
    await model.deleteMany({});
    await model.createIndexes();
    for (let i = 0; i < rows.length; i += 2000) await model.insertMany(rows.slice(i, i + 2000), { ordered: false, lean: true });
    console.log(`  wrote ${rows.length} ${label}`);
  }
  console.log("\nDone. Next: connect Google Chat on /service/chat (the old connection is not copied).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
