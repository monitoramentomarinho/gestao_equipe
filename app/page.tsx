"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const router = useRouter();

  async function handleLogin(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const snap = await getDoc(doc(db, "users", cred.user.uid));

      if (!snap.exists()) {
        setErro("Usuário sem perfil cadastrado.");
        return;
      }

      const { role } = snap.data();
      router.push(role === "supervisor" ? "/supervisor" : "/agente");
    } catch (err: any) {
      console.error("Erro detalhado do Firebase:", err);

      // Personaliza o erro dependendo do que o Firebase retornar
      if (err.code === "auth/invalid-credential") {
        setErro("E-mail ou senha inválidos.");
      } else if (err.code === "permission-denied") {
        setErro("Erro de permissão no banco de dados.");
      } else {
        setErro("Ocorreu um erro ao tentar fazer login.");
      }
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Acesso ao Sistema</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {/* Exibição condicional do erro na tela utilizando a variável CSS de cor destrutiva */}
          {erro && (
            <p className="text-sm font-medium text-destructive text-center">
              {erro}
            </p>
          )}

          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
