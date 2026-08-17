import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@/types/note";

const NOTE_COLUMNS = "id,content,tags,created_at,updated_at";

function mapNote(note: Note): Note {
  return {
    ...note,
    tags: Array.isArray(note.tags) ? note.tags : null,
  };
}

export async function listNotes() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Note[]).map(mapNote);
}

export async function getNoteById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNote(data as Note);
}

export async function createNote(input: CreateNoteInput) {
  const supabase = await createSupabaseServerClient();
  const content = input.content.trim();

  if (!content) {
    throw new Error("Conteúdo da anotação não pode ser vazio.");
  }

  const tags =
    Array.isArray(input.tags) && input.tags.length > 0
      ? input.tags.map((t) => t.trim()).filter(Boolean)
      : null;

  const { data, error } = await supabase
    .from("notes")
    .insert({ content, tags })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNote(data as Note);
}

export async function updateNote(id: string, input: UpdateNoteInput) {
  const supabase = await createSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {};

  if (typeof input.content === "string") {
    const trimmed = input.content.trim();
    if (!trimmed) throw new Error("Conteúdo da anotação não pode ser vazio.");
    updatePayload.content = trimmed;
  }

  if (input.tags !== undefined) {
    updatePayload.tags =
      Array.isArray(input.tags) && input.tags.length > 0
        ? input.tags.map((t) => t.trim()).filter(Boolean)
        : null;
  }

  if (!Object.keys(updatePayload).length) {
    return getNoteById(id);
  }

  const { data, error } = await supabase
    .from("notes")
    .update(updatePayload)
    .eq("id", id)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNote(data as Note);
}

export async function deleteNote(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
