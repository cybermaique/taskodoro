import { NextRequest, NextResponse } from "next/server";
import { createNoteAttachment } from "@/lib/notes";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const file = (await request.formData()).get("file"); if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 }); return NextResponse.json({ note: await createNoteAttachment(id, file) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível anexar o arquivo." }, { status: 500 }); }
}
