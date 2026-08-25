import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest, unauthorizedResponse } from "@/lib/access";
import { createTaskComment } from "@/lib/tasks";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try { const { id } = await params; const body = await request.json(); return NextResponse.json({ task: await createTaskComment(id, typeof body.content === "string" ? body.content : "") }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível adicionar o comentário." }, { status: 500 }); }
}
