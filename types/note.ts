export interface NoteAttachment {
  id: string;
  note_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  file_size: number | null;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  is_pinned: boolean;
  deleted_at: string | null;
  attachments: NoteAttachment[];
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[] | null;
  is_pinned?: boolean;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[] | null;
  is_pinned?: boolean;
}
