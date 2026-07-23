"use client";

import { FormEvent, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AccessGateProps {
  children: React.ReactNode;
}

interface AccessState {
  enabled: boolean;
  authorized: boolean;
}

export function AccessGate({ children }: AccessGateProps) {
  const [state, setState] = useState<AccessState | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/access", { cache: "no-store" });
      const data = (await response.json()) as AccessState;
      setState(data);
    };

    run().catch(() => {
      setState({ enabled: false, authorized: true });
    });
  }, []);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Senha inválida.");
      }

      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao validar acesso.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!state) {
    return (
      <div className="access-loading-safe-insets min-h-svh">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Carregando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!state.enabled || state.authorized) {
    return <>{children}</>;
  }

  return (
    <div className="access-safe-insets grid min-h-svh place-items-center">
      <Card className="w-full max-w-md border-border/70">
        <CardHeader>
          <CardTitle>Acesso protegido</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitPassword}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite a senha"
              className="h-11 sm:h-8"
              required
            />
            {errorMessage ? (
              <p className="break-words text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 w-full sm:min-h-8"
            >
              {isSubmitting ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
