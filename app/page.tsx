import { cookies } from "next/headers";

import { AccessGate } from "@/components/access-gate";
import { Dashboard } from "@/components/dashboard";
import { accessCookieName, env } from "@/lib/env";
import { listNotes } from "@/lib/notes";
import { listTasks } from "@/lib/tasks";
import type { Note } from "@/types/note";
import type { Task } from "@/types/task";

async function getInitialData() {
  const cookieStore = await cookies();
  const appPasswordEnabled = Boolean(env.APP_PASSWORD);
  const hasAccessCookie = cookieStore.get(accessCookieName)?.value === "1";

  if (appPasswordEnabled && !hasAccessCookie) {
    return { tasks: [] as Task[], notes: [] as Note[] };
  }

  try {
    const [tasks, notes] = await Promise.all([listTasks(), listNotes()]);
    return { tasks, notes };
  } catch {
    return { tasks: [] as Task[], notes: [] as Note[] };
  }
}

export default async function HomePage() {
  const { tasks, notes } = await getInitialData();

  return (
    <AccessGate>
      <Dashboard initialTasks={tasks} initialNotes={notes} />
    </AccessGate>
  );
}
