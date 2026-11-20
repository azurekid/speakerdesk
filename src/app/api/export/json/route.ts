import { NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup";
import { getCurrentUser } from "@/lib/dal";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const backup = await buildBackup(user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="speakerdesk-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
