import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { putPublicFile, sniffImage } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const kind = form.get("kind") === "wide" ? "wide" : "square";
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 8 MB or smaller" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) return NextResponse.json({ error: "Use a JPEG, PNG or WebP image" }, { status: 415 });

  const url = await putPublicFile(`${user.id}/${kind}-${randomUUID()}.${type.ext}`, buf, type.mime);
  await prisma.speakerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, [kind === "wide" ? "headshotWideUrl" : "headshotSquareUrl"]: url },
    update: { [kind === "wide" ? "headshotWideUrl" : "headshotSquareUrl"]: url },
  });
  return NextResponse.json({ url });
}
