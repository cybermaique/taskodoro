import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteTask, updateTask } from "@/lib/tasks";
import type { TaskPriority, TaskStatus } from "@/types/task";

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
    const status =
      body.status === "not_started" ||
      body.status === "in_progress" ||
      body.status === "completed" ||
      body.status === "waiting"
        ? (body.status as TaskStatus)
        : undefined;

    const priority =
      body.priority === "low" || body.priority === "medium" || body.priority === "high"
        ? (body.priority as TaskPriority)
        : undefined;
    const task = await updateTask(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      description:
        body.description === null || typeof body.description === "string"
          ? body.description
          : undefined,
      status,
      priority,
      category:
        body.category === null || typeof body.category === "string"
          ? body.category
          : undefined,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar tarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir tarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
