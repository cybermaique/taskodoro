function readRequiredEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: () =>
    readRequiredEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () =>
    readRequiredEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  APP_PASSWORD: process.env.APP_PASSWORD?.trim() ?? "",
};

export const accessCookieName = "pomodoro_access";
