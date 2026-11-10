import { PageContainer } from "@/app/_components/shell/PageContainer";
import { istMonth } from "@/lib/service/chat/months";
import { AttendanceView } from "./_components/AttendanceView";

// Attendance check: the attendance Chat space only announces leaves, so every working day without an announced leave needs a
// report in the person's own place (Upwork TIMER STATUS or the theme team's Theme Status Group). Days with none are flagged.
export const dynamic = "force-dynamic";

export default function AttendancePage() {
  return (
    <PageContainer className="max-w-7xl gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Attendance</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Leaves are announced in the attendance Chat space. Monday to Friday, everyone is expected to have a report in Upwork or the theme team unless a leave
          was announced; a day with neither is flagged. Saturdays are flexible and never flagged, Sundays are off.
        </p>
      </div>
      <AttendanceView initialMonth={istMonth(new Date())} />
    </PageContainer>
  );
}
