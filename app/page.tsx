import { AccessGate } from "@/components/access-gate";
import { Dashboard } from "@/components/dashboard";
import { listNotes } from "@/lib/notes";
import { listTasks } from "@/lib/tasks";
import type { Note } from "@/types/note";
import type { Task } from "@/types/task";

async function getInitialData() {
  try {
    const [tasks, notes] = await Promise.all([listTasks(), listNotes()]);
    return { tasks, notes };
  } catch {
    return { tasks: [] as Task[], notes: [] as Note[] };
  }
}

export default async function HomePage() {
  const { tasks, notes } = await getInitialData();
  return <AccessGate><Dashboard initialTasks={tasks} initialNotes={notes} /></AccessGate>;
}
