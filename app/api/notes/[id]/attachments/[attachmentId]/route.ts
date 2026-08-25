import { NextRequest, NextResponse } from "next/server";
import { deleteNoteAttachment, getNoteAttachment } from "@/lib/notes";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try { const { id, attachmentId } = await params; const { attachment, data } = await getNoteAttachment(id, attachmentId); return new NextResponse(data, { headers: { "Content-Type": attachment.mime_type, "Content-Disposition": request.nextUrl.searchParams.get("download") === "1" ? `attachment; filename="${attachment.file_name}"` : `inline; filename="${attachment.file_name}"` } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível abrir o anexo." }, { status: 500 }); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try { const { id, attachmentId } = await params; return NextResponse.json({ note: await deleteNoteAttachment(id, attachmentId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir o anexo." }, { status: 500 }); }
}
