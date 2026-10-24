import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { missedReportsForMonth, reportMonths, todayInIst } from "@/lib/chat/teamActivity";

/** Which days each tracked member sent no time report, for ?month=YYYY-MM (default: this month). */
export async function GET(request: Request) {
  await connectToDatabase();
  const months = await reportMonths();
  const asked = new URL(request.url).searchParams.get("month");
  const month = asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : todayInIst().slice(0, 7);
  return NextResponse.json({ months: months.includes(month) ? months : [month, ...months], ...(await missedReportsForMonth(month)) });
}
