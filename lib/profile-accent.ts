import { PROFILE_ACCENTS, type ProfileAccent } from "@/types/profile";

export const PROFILE_ACCENT_STORAGE_KEY = "taskboard_profile_accent";

function profileAccentKey(userId: string) {
  return `${PROFILE_ACCENT_STORAGE_KEY}:${userId}`;
}

export function normalizeProfileAccent(value: unknown): ProfileAccent {
  return PROFILE_ACCENTS.includes(value as ProfileAccent)
    ? (value as ProfileAccent)
    : "teal";
}

export function applyProfileAccent(value: unknown) {
  const accent = normalizeProfileAccent(value);

  if (typeof document !== "undefined") {
    document.documentElement.dataset.profileAccent = accent;
  }

  return accent;
}

export function rememberProfileAccent(value: unknown, userId?: string) {
  if (typeof window === "undefined") return;

  const accent = normalizeProfileAccent(value);
  window.localStorage.setItem(PROFILE_ACCENT_STORAGE_KEY, accent);

  if (userId) {
    window.localStorage.setItem(profileAccentKey(userId), accent);
  }
}

export function restoreProfileAccent(userId?: string) {
  if (typeof window === "undefined") return applyProfileAccent("teal");

  const storedAccent = userId
    ? window.localStorage.getItem(profileAccentKey(userId)) ??
      window.localStorage.getItem(PROFILE_ACCENT_STORAGE_KEY)
    : window.localStorage.getItem(PROFILE_ACCENT_STORAGE_KEY);

  return applyProfileAccent(storedAccent);
}
