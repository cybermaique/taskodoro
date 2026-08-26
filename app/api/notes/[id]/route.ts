import { NextResponse } from "next/server";

import { deleteNote, updateNote } from "@/lib/notes";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      tags?: string[] | null;
      is_pinned?: boolean;
      pinned_position?: number | null;
    };
    const note = await updateNote(id, {
      title: body.title,
      content: body.content,
      tags: body.tags,
      is_pinned: body.is_pinned,
      pinned_position: body.pinned_position,
    });
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar anotação.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteNote(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao excluir anotação.",
      },
      { status: 500 },
    );
  }
}
