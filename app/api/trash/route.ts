import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { listTrashedNotes } from "@/lib/notes";
import { listTrashedTasks } from "@/lib/tasks";

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const [tasks, notes] = await Promise.all([listTrashedTasks(), listTrashedNotes()]);
    return NextResponse.json({ tasks, notes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível abrir a lixeira." }, { status: 500 });
  }
}
