// SERVER route — the vendor backend the client contract fetch calls. This is
// where your database/ORM lives (see the Prisma recipe), and where a
// platform API key would be injected if you proxy the Workspace Service
// (never expose keys via NEXT_PUBLIC_*).
import { NextResponse, type NextRequest } from "next/server";

const TICKETS = Array.from({ length: 18 }, (_, i) => ({
  id: `T-${200 + i}`,
  subject: `Ticket ${i + 1}`,
  priority: (["low", "normal", "urgent"] as const)[i % 3]!,
  assignee: ["ana", "ben", "chao"][i % 3]!,
  ageHours: ((i * 7) % 90) + 2,
  opened: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
}));

export function GET(request: NextRequest) {
  // The end user's token arrives on the request — scope rows with it.
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  return NextResponse.json(TICKETS);
}
