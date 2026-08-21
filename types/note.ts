export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  is_pinned: boolean;
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
