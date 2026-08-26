import { NextResponse } from "next/server";

import { reorderPinnedNotes } from "@/lib/notes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { noteIds?: unknown };
    if (
      !Array.isArray(body.noteIds) ||
      body.noteIds.some((id) => typeof id !== "string")
    ) {
      return NextResponse.json(
        { error: "A ordem das anotações é inválida." },
        { status: 400 },
      );
    }

    await reorderPinnedNotes(body.noteIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao reordenar anotações fixadas.",
      },
      { status: 500 },
    );
  }
}
