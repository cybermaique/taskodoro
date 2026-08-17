import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { createTaskAttachment } from "@/lib/tasks";

interface RouteParams { params: Promise<{ id: string }> }
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo válido." }, { status: 400 });
    }
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: "O arquivo deve ter no máximo 10 MB." }, { status: 400 });
    }
    const task = await createTaskAttachment({ taskId: id, file });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao anexar imagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
