"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogIn, LogOut, Sparkles, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SoundToggle,
  useSensoryEffects,
} from "@/components/sensory-effects";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function AccessTransition({ message }: { message: string }) {
  return (
    <main className="access-transition-overlay">
      <div className="access-transition-ripple" />
      <div className="access-transition-content">
        <span className="access-logo-orbit">
          <Sparkles className="size-7" />
        </span>
        <p>{message}</p>
      </div>
    </main>
  );
}

export function AccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { playSound } = useSensoryEffects();
  const [session, setSession] = useState<Session | null | undefined>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnteringApp, setIsEnteringApp] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refreshedSessionId = useRef<string | null>(null);

  const syncSession = useCallback(
    (nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession) {
        refreshedSessionId.current = null;
        return;
      }

      if (refreshedSessionId.current !== nextSession.user.id) {
        refreshedSessionId.current = nextSession.user.id;
        router.refresh();
      }
    },
    [router],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .getSession()
      .then(({ data }) => syncSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => syncSession(nextSession),
    );
    return () => listener.subscription.unsubscribe();
  }, [syncSession]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setIsSubmitting(false);
      setMessage(result.error.message);
      playSound("error");
      return;
    }

    if (isSignUp && !result.data.session) {
      setIsSubmitting(false);
      setMessage("Conta criada. Confirme seu e-mail para entrar.");
      playSound("success");
      return;
    }

    playSound("login");
    setIsEnteringApp(true);
    window.setTimeout(() => window.location.reload(), 900);
  };

  const signOut = async () => {
    setIsSigningOut(true);
    playSound("logout");
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    await createSupabaseBrowserClient().auth.signOut();
    window.location.reload();
  };

  if (session === undefined) {
    return (
      <main className="access-loading-safe-insets access-loading-screen">
        <span className="access-logo-orbit">
          <Sparkles className="size-7" />
        </span>
      </main>
    );
  }

  if (isEnteringApp || (session && isSubmitting)) {
    return <AccessTransition message="Preparando seu espaço…" />;
  }

  if (isSigningOut) {
    return <AccessTransition message="Até a próxima!" />;
  }

  if (session) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          className="app-floating-control fixed right-3 top-3 z-50 gap-1.5 bg-background/80 backdrop-blur"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
        {children}
      </>
    );
  }

  return (
    <main className="access-safe-insets access-scene grid min-h-svh place-items-center">
      <div className="access-grid" />
      <span className="access-orb access-orb-one" />
      <span className="access-orb access-orb-two" />
      <span className="access-orb access-orb-three" />

      <Card
        key={isSignUp ? "signup" : "signin"}
        className="access-card-enter relative z-10 w-full max-w-md overflow-hidden border-border/70 bg-background/82 shadow-2xl backdrop-blur-xl"
      >
        <span className="access-card-shine" />
        <SoundToggle className="absolute right-3 top-3 z-20" />
        <CardHeader className="items-center text-center">
          <span className="access-login-icon">
            {isSignUp ? (
              <UserPlus className="size-6" />
            ) : (
              <LogIn className="size-6" />
            )}
          </span>
          <CardTitle className="text-2xl">
            {isSignUp ? "Criar conta" : "Bem-vindo de volta"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Crie seu espaço para organizar tudo."
              : "Entre e continue de onde parou."}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="h-11"
              required
            />
            <Input
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className="h-11"
              minLength={6}
              required
            />
            {message ? (
              <p className="app-message-enter rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-sm text-destructive">
                {message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 w-full overflow-hidden"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isSignUp ? (
                <UserPlus className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              {isSubmitting
                ? "Aguarde…"
                : isSignUp
                  ? "Criar conta"
                  : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => {
                setIsSignUp((value) => !value);
                setMessage(null);
              }}
            >
              {isSignUp ? "Já tenho uma conta" : "Criar uma conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
