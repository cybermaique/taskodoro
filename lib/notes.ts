import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { CreateNoteInput, Note, NoteAttachment, UpdateNoteInput } from "@/types/note";

const NOTE_COLUMNS = `id,title,content,tags,is_pinned,pinned_position,deleted_at,created_at,updated_at,
  note_attachments(id,note_id,file_name,mime_type,storage_path,file_size,created_at)`;

function normalizeNoteTitle(title: string) {
  return title.trim().slice(0, 160);
}

function normalizeNoteContent(content: string) {
  const trimmed = content.trim();
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}

function mapNote(note: Note): Note {
  return {
    ...note,
    tags: Array.isArray(note.tags) ? note.tags : null,
    is_pinned: note.is_pinned === true,
    pinned_position:
      typeof note.pinned_position === "number" ? note.pinned_position : null,
    attachments: Array.isArray((note as Note & { note_attachments?: NoteAttachment[] }).note_attachments)
      ? (note as Note & { note_attachments: NoteAttachment[] }).note_attachments
      : note.attachments ?? [],
  };
}

function attachmentMimeType(file: File) {
  return file.type || "application/octet-stream";
}

export async function createNoteAttachment(noteId: string, file: File) {
  const supabase = await createSupabaseServerClient();
  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "bin";
  const storagePath = `${noteId}/${crypto.randomUUID()}.${extension}`;
  const mimeType = attachmentMimeType(file);
  const { error: uploadError } = await supabase.storage.from("note-attachments").upload(storagePath, file, { contentType: mimeType });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from("note_attachments").insert({ note_id: noteId, file_name: file.name || `arquivo.${extension}`, mime_type: mimeType, storage_path: storagePath, file_size: file.size });
  if (error) { await supabase.storage.from("note-attachments").remove([storagePath]); throw new Error(error.message); }
  return getNoteById(noteId);
}

export async function getNoteAttachment(noteId: string, attachmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: attachment, error } = await supabase.from("note_attachments").select("id,note_id,file_name,mime_type,storage_path,file_size,created_at").eq("id", attachmentId).eq("note_id", noteId).single();
  if (error) throw new Error(error.message);
  const { data, error: downloadError } = await supabase.storage.from("note-attachments").download((attachment as NoteAttachment).storage_path);
  if (downloadError) throw new Error(downloadError.message);
  return { attachment: attachment as NoteAttachment, data };
}

export async function deleteNoteAttachment(noteId: string, attachmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("note_attachments").select("storage_path").eq("id", attachmentId).eq("note_id", noteId).single();
  if (error) throw new Error(error.message);
  const { error: deleteError } = await supabase.from("note_attachments").delete().eq("id", attachmentId).eq("note_id", noteId);
  if (deleteError) throw new Error(deleteError.message);
  await supabase.storage.from("note-attachments").remove([(data as { storage_path: string }).storage_path]);
  return getNoteById(noteId);
}

export async function listNotes() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Note[]).map(mapNote);
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

  return mapNote(data as unknown as Note);
}

export async function createNote(input: CreateNoteInput) {
  const supabase = await createSupabaseServerClient();
  const title = normalizeNoteTitle(input.title);
  const content = normalizeNoteContent(input.content);

  if (!title) {
    throw new Error("TÃ­tulo da anotaÃ§Ã£o nÃ£o pode ser vazio.");
  }

  if (!content) {
    throw new Error("Conteúdo da anotação não pode ser vazio.");
  }

  const tags =
    Array.isArray(input.tags) && input.tags.length > 0
      ? input.tags.map((t) => t.trim()).filter(Boolean)
      : null;

  const { data, error } = await supabase
    .from("notes")
    .insert({ title, content, tags, is_pinned: false })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNote(data as unknown as Note);
}

export async function updateNote(id: string, input: UpdateNoteInput) {
  const supabase = await createSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {};

  if (typeof input.title === "string") {
    const title = normalizeNoteTitle(input.title);
    if (!title) throw new Error("TÃ­tulo da anotaÃ§Ã£o nÃ£o pode ser vazio.");
    updatePayload.title = title;
  }

  if (typeof input.content === "string") {
    const content = normalizeNoteContent(input.content);
    if (!content) throw new Error("Conteúdo da anotação não pode ser vazio.");
    updatePayload.content = content;
  }

  if (input.tags !== undefined) {
    updatePayload.tags =
      Array.isArray(input.tags) && input.tags.length > 0
        ? input.tags.map((t) => t.trim()).filter(Boolean)
        : null;
  }

  if (typeof input.is_pinned === "boolean") {
    updatePayload.is_pinned = input.is_pinned;
  }

  if (typeof input.pinned_position === "number" || input.pinned_position === null) {
    updatePayload.pinned_position = input.pinned_position;
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

  return mapNote(data as unknown as Note);
}

export async function deleteNote(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function reorderPinnedNotes(noteIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const uniqueIds = [...new Set(noteIds)].filter((id) => id.trim().length > 0);
  if (uniqueIds.length === 0) return;

  const { data, error } = await supabase
    .from("notes")
    .select("id")
    .in("id", uniqueIds)
    .eq("is_pinned", true)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const pinnedIds = new Set((data ?? []).map((note) => note.id as string));
  const orderedIds = uniqueIds.filter((id) => pinnedIds.has(id));

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("notes")
        .update({ pinned_position: index })
        .eq("id", id)
        .eq("is_pinned", true)
        .is("deleted_at", null),
    ),
  );
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) throw new Error(updateError.message);
}

export async function listTrashedNotes() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Note[]).map(mapNote);
}

export async function restoreNote(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notes").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
  return getNoteById(id);
}
