"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (result.error) return setMessage(result.error.message);
    if (isSignUp && !result.data.session) {
      return setMessage("Conta criada. Confirme seu e-mail para entrar.");
    }
    window.location.reload();
  };

  if (session === undefined) return <div className="access-loading-safe-insets min-h-svh" />;
  if (session) return <><Button type="button" variant="ghost" className="fixed right-3 top-3 z-50 bg-background/80 backdrop-blur" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.reload(); }}>Sair</Button>{children}</>;

  return <main className="access-safe-insets grid min-h-svh place-items-center"><Card className="w-full max-w-md border-border/70"><CardHeader><CardTitle>{isSignUp ? "Criar conta" : "Entrar"}</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={submit}><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /><Input type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" minLength={6} required />{message ? <p className="text-sm text-destructive">{message}</p> : null}<Button type="submit" disabled={isSubmitting} className="min-h-11 w-full sm:min-h-8">{isSubmitting ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => { setIsSignUp((value) => !value); setMessage(null); }}>{isSignUp ? "Já tenho uma conta" : "Criar uma conta"}</Button></form></CardContent></Card></main>;
}
