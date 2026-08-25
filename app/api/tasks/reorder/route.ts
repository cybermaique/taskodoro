import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { reorderTasks } from "@/lib/tasks";

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const taskIds = Array.isArray(body.task_ids)
      ? body.task_ids.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const tasks = await reorderTasks(taskIds);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ordenar as tarefas." }, { status: 500 });
  }
}
