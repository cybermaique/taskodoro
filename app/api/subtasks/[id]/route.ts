import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteSubtask, getSubtaskById, getTaskById, updateSubtask } from "@/lib/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();

    const subtask = await updateSubtask(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      is_completed:
        typeof body.is_completed === "boolean" ? body.is_completed : undefined,
    });

    const task = await getTaskById(subtask.task_id);
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar subtarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const subtask = await getSubtaskById(id);
    await deleteSubtask(id);
    const task = await getTaskById(subtask.task_id);

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir subtarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
