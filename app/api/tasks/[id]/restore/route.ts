import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { restoreTask } from "@/lib/tasks";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try { const { id } = await params; return NextResponse.json({ task: await restoreTask(id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível restaurar a tarefa." }, { status: 500 }); }
}
