"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Church } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("Credenciais inválidas.");
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Church identity header */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="bg-blue-700 text-white rounded-full p-3">
            <Church className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 text-center leading-tight">
            IEQ Canto do Mar
          </h1>
          <p className="text-sm text-gray-500">Relatório de Culto</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Acesse o sistema com seu e-mail e senha.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                {error && (
                  <p
                    id="login-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full mt-1"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
