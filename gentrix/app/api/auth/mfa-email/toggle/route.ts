import { NextResponse } from "next/server";

// Twee-stapsverificatie is verplicht voor alle accounts en kan niet worden uitgeschakeld.
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Twee-stapsverificatie is verplicht voor alle accounts en kan niet worden uitgeschakeld." },
    { status: 403 },
  );
}
