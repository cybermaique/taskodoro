import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteTaskAttachment, getTaskAttachment } from "@/lib/tasks";

interface RouteParams { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const { id, attachmentId } = await params;
    const { attachment, data } = await getTaskAttachment(id, attachmentId);
    return new NextResponse(data, {
      headers: {
        "Content-Type": attachment.mime_type,
        "Content-Disposition": `${attachment.mime_type.startsWith("image/") ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.file_name)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Imagem não encontrada.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const { id, attachmentId } = await params;
    const task = await deleteTaskAttachment(id, attachmentId);
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir imagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
