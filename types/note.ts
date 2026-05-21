export interface Note {
  id: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  content: string;
  tags?: string[] | null;
}

export interface UpdateNoteInput {
  content?: string;
  tags?: string[] | null;
}
