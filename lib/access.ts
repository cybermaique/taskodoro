import { NextRequest, NextResponse } from "next/server";

import { accessCookieName, env } from "@/lib/env";

export function isPasswordProtectionEnabled() {
  return Boolean(env.APP_PASSWORD);
}

export function isAuthorizedRequest(request: NextRequest) {
  if (!isPasswordProtectionEnabled()) {
    return true;
  }

  const cookieValue = request.cookies.get(accessCookieName)?.value;
  return cookieValue === "1";
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
}

export function validateAccessPassword(password: string) {
  if (!isPasswordProtectionEnabled()) {
    return true;
  }

  return password === env.APP_PASSWORD;
}
