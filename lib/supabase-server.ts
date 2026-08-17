import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => undefined,
      },
    },
  );
}
