import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { parseTeamMemberInput } from "@/lib/projects/sanitize";
import { TeamMember } from "@/models/team-member";

export async function PATCH(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!isValidObjectId(memberId)) return invalidIdResponse("memberId");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  const parsed = parseTeamMemberInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();
  try {
    const member = await TeamMember.findByIdAndUpdate(memberId, parsed.value, { new: true, runValidators: true }).lean();
    if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    return NextResponse.json({ member });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return NextResponse.json({ error: "A team member with that email already exists." }, { status: 409 });
    throw err;
  }
}

/** Also removes the member from every project they were assigned to (see models/team-member.ts). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!isValidObjectId(memberId)) return invalidIdResponse("memberId");
  await connectToDatabase();
  const member = await TeamMember.findByIdAndDelete(memberId).lean();
  if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
