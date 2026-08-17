import { NextRequest, NextResponse } from "next/server";


export function isPasswordProtectionEnabled() {
  return false;
}

export function isAuthorizedRequest(request: NextRequest) {
  void request;
  return true;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
}

export function validateAccessPassword(password: string) {
  return Boolean(password);
}
