function readRequiredEnv(
  key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: () => readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: () => readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  APP_PASSWORD: process.env.APP_PASSWORD?.trim() ?? "",
};

export const accessCookieName = "pomodoro_access";
