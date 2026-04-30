import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  if (process.env.REQUIRE_MFA === "true") {
    return NextResponse.json(
      { error: "Twee-stapsverificatie is verplicht voor alle accounts en kan niet worden uitgeschakeld." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, enabled: false });
}
