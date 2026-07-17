"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { updatePassword } from "firebase/auth";

export default function PerfilAgente() {
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

    // Validações básicas
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

      if (!user) {
        throw new Error("Usuário não está logado.");
      }

      // Função nativa do Firebase para atualizar a senha
      await updatePassword(user, novaSenha);

      setNovaSenha("");
      setConfirmarSenha("");
      setSucesso(true);

      // Esconde a mensagem de sucesso após 4 segundos
      setTimeout(() => setSucesso(false), 4000);
    } catch (err: any) {
      console.error(err);

      // O Firebase exige que o usuário tenha feito login recentemente para mudar a senha
      if (err.code === "auth/requires-recent-login") {
        setErro(
          "Para sua segurança, você precisa sair do sistema (Logout) e fazer login novamente antes de alterar a senha.",
        );
      } else {
        setErro("Ocorreu um erro ao atualizar a senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Meu Perfil
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Atualize suas credenciais de acesso ao sistema.
        </p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
          Alterar Senha
        </h2>

        <form onSubmit={handleAlterarSenha} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Nova Senha
            </label>
            <Input
              type="password"
              placeholder="Digite a nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Confirmar Nova Senha
            </label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p className="text-sm font-medium text-destructive">{erro}</p>
          )}
          {sucesso && (
            <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-200 text-center">
              Sua senha foi alterada com sucesso!
            </div>
          )}

          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar Senha"}
          </Button>
        </form>
      </div>
    </main>
  );
}
