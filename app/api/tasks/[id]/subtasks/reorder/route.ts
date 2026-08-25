import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { reorderSubtasks } from "@/lib/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const subtaskIds = Array.isArray(body.subtask_ids)
      ? body.subtask_ids.filter((value: unknown): value is string => typeof value === "string")
      : [];

    if (subtaskIds.length > 100) {
      return NextResponse.json(
        { error: "A tarefa não pode ter tantas subtarefas." },
        { status: 400 },
      );
    }

    const task = await reorderSubtasks(id, subtaskIds);
    return NextResponse.json({ task });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível reordenar as subtarefas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
