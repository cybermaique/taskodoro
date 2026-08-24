import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { restoreTaskDescription } from "@/lib/tasks";

interface RouteParams {
  params: Promise<{ id: string; historyId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();

  try {
    const { id, historyId } = await params;
    const task = await restoreTaskDescription(id, historyId);
    return NextResponse.json({ task });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível restaurar a descrição.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
