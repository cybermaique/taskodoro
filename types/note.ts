export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[] | null;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[] | null;
}
