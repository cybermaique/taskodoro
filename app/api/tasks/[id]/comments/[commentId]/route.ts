import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteTaskComment } from "@/lib/tasks";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try { const { id, commentId } = await params; return NextResponse.json({ task: await deleteTaskComment(id, commentId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir o comentário." }, { status: 500 }); }
}
