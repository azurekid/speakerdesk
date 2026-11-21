import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { searchPlaces } from "@/lib/places";

/** Venue / address type-ahead for the event form. Signed-in users only, so it isn't an open proxy. */
export async function GET(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ places: await searchPlaces(q) }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    console.error("venue search failed", err);
    return NextResponse.json({ places: [], error: "Venue search is unavailable right now. Type the details in by hand." }, { status: 502 });
  }
}
