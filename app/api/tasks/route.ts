import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { createTask, listTasks } from "@/lib/tasks";
import type { TaskPriority, TaskType } from "@/types/task";

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
    const type =
      body.type === "feature" ||
      body.type === "bug" ||
      body.type === "improvement" ||
      body.type === "task" ||
      body.type === "date" ||
      body.type === "study" ||
      body.type === "travel" ||
      body.type === "health" ||
      body.type === "finance" ||
      body.type === "personal"
        ? (body.type as TaskType)
        : undefined;
    const subtasks = Array.isArray(body.subtasks)
      ? body.subtasks
          .filter((title: unknown): title is string => typeof title === "string")
          .map((title: string) => title.trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined;
    const task = await createTask({
      title,
      description: typeof body.description === "string" ? body.description : "",
      priority,
      type,
      category:
        body.category === null || typeof body.category === "string"
          ? body.category
          : undefined,
      subtasks,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar tarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
