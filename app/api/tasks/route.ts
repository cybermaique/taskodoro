import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { createTask, listTasks } from "@/lib/tasks";
import type { TaskPriority, TaskRecurrence } from "@/types/task";

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const tasks = await listTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar tarefas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Informe um título para a tarefa." },
        { status: 400 },
      );
    }

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

    const task = await createTask({
      title,
      description: typeof body.description === "string" ? body.description : "",
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
        typeof body.estimated_minutes === "number" ? body.estimated_minutes : null,
      recurrence,
      pomodoro_minutes:
        typeof body.pomodoro_minutes === "number" ? body.pomodoro_minutes : null,
      break_minutes: typeof body.break_minutes === "number" ? body.break_minutes : null,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar tarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
