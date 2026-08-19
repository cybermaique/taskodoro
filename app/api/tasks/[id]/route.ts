import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { deleteTask, updateTask } from "@/lib/tasks";
import type { TaskPriority, TaskRecurrence, TaskStatus } from "@/types/task";

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
      body.status === "pending" ||
      body.status === "in_progress" ||
      body.status === "completed" ||
      body.status === "canceled"
        ? (body.status as TaskStatus)
        : undefined;

    const priority =
      body.priority === "low" || body.priority === "medium" || body.priority === "high"
        ? (body.priority as TaskPriority)
        : undefined;
    const recurrence =
      body.recurrence === "daily" ||
      body.recurrence === "weekly" ||
      body.recurrence === "monthly" ||
      body.recurrence === "none"
        ? (body.recurrence as TaskRecurrence)
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
      due_date:
        body.due_date === null || typeof body.due_date === "string"
          ? body.due_date
          : undefined,
      planned_for:
        body.planned_for === null || typeof body.planned_for === "string"
          ? body.planned_for
          : undefined,
      estimated_minutes:
        typeof body.estimated_minutes === "number"
          ? body.estimated_minutes
          : body.estimated_minutes === null
            ? null
            : undefined,
      recurrence,
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
