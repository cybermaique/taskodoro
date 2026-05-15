import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { createSubtask, getTaskById } from "@/lib/tasks";

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
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Informe um título para a subtarefa." },
        { status: 400 },
      );
    }

    await createSubtask({ task_id: id, title });
    const task = await getTaskById(id);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar subtarefa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
