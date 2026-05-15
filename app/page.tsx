import { cookies } from "next/headers";

import { AccessGate } from "@/components/access-gate";
import { Dashboard } from "@/components/dashboard";
import { accessCookieName, env } from "@/lib/env";
import { listTasks } from "@/lib/tasks";
import type { Task } from "@/types/task";

async function getInitialTasks() {
  const cookieStore = await cookies();
  const appPasswordEnabled = Boolean(env.APP_PASSWORD);
  const hasAccessCookie = cookieStore.get(accessCookieName)?.value === "1";

  if (appPasswordEnabled && !hasAccessCookie) {
    return [] as Task[];
  }

  try {
    return await listTasks();
  } catch {
    return [] as Task[];
  }
}

export default async function HomePage() {
  const initialTasks = await getInitialTasks();

  return (
    <AccessGate>
      <Dashboard initialTasks={initialTasks} />
    </AccessGate>
  );
}
