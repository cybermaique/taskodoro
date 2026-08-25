"use client";

import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogIn, Sparkles, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSensoryEffects } from "@/components/sensory-effects";
import {
  applyProfileAccent,
  rememberProfileAccent,
  restoreProfileAccent,
} from "@/lib/profile-accent";
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

function getFallbackNickname(email: string | undefined) {
  return email?.split("@")[0]?.trim() || "Usuário";
}

interface AccessActionsContextValue {
  signOut: () => Promise<void>;
}

const AccessActionsContext = createContext<AccessActionsContextValue | null>(
  null,
);

export function useAccessActions() {
  const context = useContext(AccessActionsContext);
  if (!context) {
    throw new Error("useAccessActions must be used within AccessGate");
  }
  return context;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { playSound, unlockAudio } = useSensoryEffects();
  const [session, setSession] = useState<Session | null | undefined>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnteringApp, setIsEnteringApp] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profileNickname, setProfileNickname] = useState<string | null>(null);
  const [transitionMessage, setTransitionMessage] = useState(
    "Preparando seu espaço…",
  );
  const refreshedSessionId = useRef<string | null>(null);

  const syncSession = useCallback(
    (nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession) {
        setProfileNickname(null);
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
    restoreProfileAccent();
  }, []);

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

  useEffect(() => {
    let isCurrent = true;
    if (!session) {
      return () => {
        isCurrent = false;
      };
    }

    void createSupabaseBrowserClient()
      .from("profiles")
      .select("nickname,accent_color")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isCurrent) {
          const accent = applyProfileAccent(data?.accent_color);
          rememberProfileAccent(accent, session.user.id);
          setProfileNickname(
            data?.nickname?.trim() || getFallbackNickname(session.user.email),
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [session]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    unlockAudio();
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
    setTransitionMessage(
      `Preparando seu espaço${profileNickname ? `, ${profileNickname}` : ""}…`,
    );
    setIsEnteringApp(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    window.location.reload();
  };

  const signOut = async () => {
    unlockAudio();
    setIsSigningOut(true);
    setTransitionMessage(
      profileNickname ? `Até logo, ${profileNickname}!` : "Até a próxima!",
    );
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
    if (profileNickname) {
      return (
        <AccessTransition
          message={transitionMessage}
        />
      );
    }
    return <AccessTransition message="Preparando seu espaço…" />;
  }

  if (isSigningOut && profileNickname) {
    return <AccessTransition message={transitionMessage} />;
  }

  if (isSigningOut) {
    return <AccessTransition message="Até a próxima!" />;
  }

  if (session) {
    return (
      <AccessActionsContext.Provider value={{ signOut }}>
        {children}
      </AccessActionsContext.Provider>
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
