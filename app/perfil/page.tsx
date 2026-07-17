"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { updatePassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function PerfilGlobal() {
  const router = useRouter();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso(false);
    setLoading(true);

    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não está logado.");

      await updatePassword(user, novaSenha);

      setNovaSenha("");
      setConfirmarSenha("");
      setSucesso(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") {
        setErro(
          "Por segurança, você precisa sair do sistema e fazer login novamente antes de alterar a senha.",
        );
      } else {
        setErro("Ocorreu um erro ao atualizar a senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4 min-h-screen bg-slate-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">
            Segurança da Conta
          </h1>
          <p className="text-sm text-slate-500">
            Defina sua nova senha de acesso.
          </p>
        </div>

        <form onSubmit={handleAlterarSenha} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Confirme a nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p className="text-sm font-medium text-destructive text-center p-2 bg-red-50 rounded-md border border-red-100">
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="text-sm font-medium text-green-700 text-center p-2 bg-green-50 rounded-md border border-green-200">
              Senha alterada com sucesso!
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Processando..." : "Atualizar Senha"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Voltar para o Painel
          </button>
        </div>
      </div>
    </main>
  );
}
