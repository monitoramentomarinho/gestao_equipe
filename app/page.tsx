"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const getErrorCode = (err: unknown): string | undefined => {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
};

export default function Home() {
  const router = useRouter();

  // Estados do formulário
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // Estados de controle da interface
  const [isRecuperando, setIsRecuperando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Função padrão de Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const snap = await getDoc(doc(db, "users", cred.user.uid));

      if (!snap.exists()) {
        setErro("Usuário sem perfil cadastrado.");
        setLoading(false);
        return;
      }

      const { role } = snap.data();
      router.push(role === "supervisor" ? "/supervisor" : "/agente");
    } catch (err: unknown) {
      console.error(err);
      const errorCode = getErrorCode(err);
      if (errorCode === "auth/invalid-credential") {
        setErro("E-mail ou senha inválidos.");
      } else {
        setErro("Ocorreu um erro ao tentar fazer login.");
      }
      setLoading(false);
    }
  }

  // Nova função para Recuperação de Senha
  async function handleRecuperarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!email) {
      setErro("Por favor, digite seu e-mail para recuperar a senha.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSucesso(
        "E-mail de recuperação enviado! Verifique sua caixa de entrada (e o spam).",
      );
      // Limpa a tela após 5 segundos e volta para o modo de login
      setTimeout(() => {
        setSucesso("");
        setIsRecuperando(false);
      }, 5000);
    } catch (err: unknown) {
      console.error(err);
      const errorCode = getErrorCode(err);
      if (errorCode === "auth/invalid-email") {
        setErro("Formato de e-mail inválido.");
      } else if (errorCode === "auth/user-not-found") {
        setErro("Não há usuário cadastrado com este e-mail.");
      } else {
        setErro("Erro ao enviar o e-mail de recuperação.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4 min-h-screen bg-blue-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in-95">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-800">
            {isRecuperando ? "Recuperar Senha" : "Acesso ao Sistema"}
          </h1>
          <p className="text-sm text-gray-500">
            {isRecuperando
              ? "Enviaremos um link de redefinição para o seu e-mail."
              : "Insira suas credenciais para entrar."}
          </p>
        </div>

        <form
          onSubmit={isRecuperando ? handleRecuperarSenha : handleLogin}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* O campo de senha só aparece se NÃO estiver no modo de recuperação */}
          {!isRecuperando && (
            <div className="space-y-2 animate-in fade-in">
              <Input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
          )}

          {/* Mensagens de feedback */}
          {erro && (
            <p className="text-sm font-medium text-destructive text-center p-2 bg-red-50 rounded-md border border-red-100">
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="text-sm font-medium text-green-700 text-center p-2 bg-green-50 rounded-md border border-green-200">
              {sucesso}
            </p>
          )}

          {/* Botão de Ação Principal */}
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading
              ? "Processando..."
              : isRecuperando
                ? "Enviar Link de Recuperação"
                : "Entrar"}
          </Button>
        </form>

        {/* Botão de Alternância (Toggle) */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setIsRecuperando(!isRecuperando);
              setErro("");
              setSucesso("");
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none"
          >
            {isRecuperando ? "Voltar para o Login" : "Esqueceu sua senha?"}
          </button>
        </div>
      </div>
    </main>
  );
}
