import { NextResponse } from "next/server";
import { restoreNote } from "@/lib/notes";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json({ note: await restoreNote(id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível restaurar a anotação." }, { status: 500 }); }
}
