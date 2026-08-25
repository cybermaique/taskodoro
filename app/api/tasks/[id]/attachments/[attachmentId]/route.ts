import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteTaskAttachment, getTaskAttachment } from "@/lib/tasks";

interface RouteParams { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const { id, attachmentId } = await params;
    const { attachment, data } = await getTaskAttachment(id, attachmentId);
    const extension = attachment.file_name.split(".").pop()?.toLocaleLowerCase();
    const mimeType =
      attachment.mime_type === "application/octet-stream" && extension === "pdf"
        ? "application/pdf"
        : attachment.mime_type;
    const canPreviewInline =
      mimeType.startsWith("image/") ||
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("text/") ||
      mimeType === "application/pdf" ||
      mimeType === "application/json";
    const forceDownload = request.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${canPreviewInline && !forceDownload ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
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
