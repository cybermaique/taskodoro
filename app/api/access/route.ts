import { NextRequest, NextResponse } from "next/server";

import {
  isAuthorizedRequest,
  isPasswordProtectionEnabled,
  validateAccessPassword,
} from "@/lib/access";
import { accessCookieName } from "@/lib/env";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    enabled: isPasswordProtectionEnabled(),
    authorized: isAuthorizedRequest(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!validateAccessPassword(password)) {
      return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: accessCookieName,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Não foi possível validar acesso." }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: accessCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
