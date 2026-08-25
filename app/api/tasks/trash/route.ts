import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { listTrashedTasks } from "@/lib/tasks";

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try { return NextResponse.json({ tasks: await listTrashedTasks() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível abrir a lixeira." }, { status: 500 }); }
}
