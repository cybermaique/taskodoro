import { NextResponse } from "next/server";

import { createNote, listNotes } from "@/lib/notes";

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao buscar anotações.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      tags?: string[];
    };
    const note = await createNote({
      title: body.title ?? "",
      content: body.content ?? "",
      tags: body.tags ?? null,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao criar anotação.",
      },
      { status: 500 },
    );
  }
}
