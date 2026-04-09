import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { assertSnapshotOwnedByClient, getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { parseAnyStoredProjectDataToLatestSnapshot } from "@/lib/site/project-snapshot-migrate";
import { projectSnapshotToCanonicalJsonString } from "@/lib/site/project-snapshot-canonical";
import { diffCanonicalJsonLines } from "@/lib/site/snapshot-text-diff";
import { isValidSubfolderSlug } from "@/lib/slug";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/** Diff op canonieke `project_snapshot_v1` tussen twee snapshot-id’s (fase 4). */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const url = new URL(request.url);
  const leftId = url.searchParams.get("left");
  const rightId = url.searchParams.get("right");
  if (!leftId || !rightId) {
    return NextResponse.json({ ok: false, error: "Query left en right (uuid) verplicht." }, { status: 400 });
  }

  const client = await getClientRowForSiteOps(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const leftRow = await assertSnapshotOwnedByClient(client.id, leftId);
  const rightRow = await assertSnapshotOwnedByClient(client.id, rightId);
  if (!leftRow || !rightRow) {
    return NextResponse.json({ ok: false, error: "Snapshot(s) niet gevonden of geen toegang." }, { status: 400 });
  }

  const leftSnap = parseAnyStoredProjectDataToLatestSnapshot(leftRow.payload_json, {});
  const rightSnap = parseAnyStoredProjectDataToLatestSnapshot(rightRow.payload_json, {});
  if (!leftSnap.ok || !rightSnap.ok) {
    const msg = !leftSnap.ok ? leftSnap.error : !rightSnap.ok ? rightSnap.error : "";
    return NextResponse.json(
      {
        ok: false,
        error: `Kan snapshot niet normaliseren: ${msg}`,
      },
      { status: 422 },
    );
  }

  const jsL = projectSnapshotToCanonicalJsonString(leftSnap.snapshot);
  const jsR = projectSnapshotToCanonicalJsonString(rightSnap.snapshot);
  const diff = diffCanonicalJsonLines(jsL, jsR);

  return NextResponse.json({
    ok: true,
    data: {
      left_id: leftId,
      right_id: rightId,
      ...diff,
    },
  });
}
