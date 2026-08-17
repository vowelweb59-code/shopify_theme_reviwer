import mongoose from "mongoose";
import { NextResponse } from "next/server";

// Shared API input-validation helpers (phase-8 §9). Mongoose throws an
// uncaught CastError — a 500 — when a malformed id reaches a query, so
// every route taking an id param checks it here first and returns a
// clean 400 instead.
export function isValidObjectId(id: string | null | undefined): boolean {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

export function invalidIdResponse(label: string): NextResponse {
  return NextResponse.json({ error: `${label} is not a valid id.` }, { status: 400 });
}
