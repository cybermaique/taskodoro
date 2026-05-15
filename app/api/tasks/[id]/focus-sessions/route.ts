import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { getTaskById, recordFocusSession } from "@/lib/tasks";

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
    const durationSeconds =
      typeof body.duration_seconds === "number" ? body.duration_seconds : 25 * 60;

    await recordFocusSession({
      taskId: id,
      durationSeconds,
      completedCycle:
        typeof body.completed_cycle === "boolean" ? body.completed_cycle : true,
    });

    const task = await getTaskById(id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao registrar sessão de foco.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
