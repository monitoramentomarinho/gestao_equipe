"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// Usamos as mesmas credenciais do seu projeto
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function CadastrarAgente() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [localidade, setLocalidade] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setLoading(true);

    if (senha.length < 6) {
      setErro("A senha provisória deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      // 1. Cria ou recupera a instância SECUNDÁRIA do Firebase
      // Isso evita que o supervisor seja deslogado ao criar uma nova conta
      const appName = "SecondaryApp";
      const secondaryApp =
        getApps().find((app) => app.name === appName) ||
        initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria o usuário na Autenticação usando o app secundário
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        senha,
      );
      const novoAgenteId = userCredential.user.uid;

      // 3. Salva os dados no banco de dados (Firestore) na coleção 'users'
      // Aqui usamos o banco principal normal (db)
      await setDoc(doc(db, "users", novoAgenteId), {
        nome: nome.trim(),
        email: email.trim(),
        localidade: localidade.trim(),
        role: "agente",
        dataCriacao: serverTimestamp(),
      });

      // 4. Desloga a instância secundária para não deixar sujeira na memória
      await signOut(secondaryAuth);

      // 5. Limpa o formulário para o próximo cadastro e exibe sucesso
      setSucesso(`Agente ${nome} cadastrado com sucesso!`);
      setNome("");
      setEmail("");
      setSenha("");
      setLocalidade("");

      // Remove a mensagem de sucesso após 5 segundos
      setTimeout(() => setSucesso(""), 5000);
    } catch (err: unknown) {
      console.error(err);
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (errorCode === "auth/email-already-in-use") {
        setErro("Este e-mail já está cadastrado no sistema.");
      } else if (errorCode === "auth/invalid-email") {
        setErro("Formato de e-mail inválido.");
      } else {
        setErro(
          "Ocorreu um erro ao cadastrar o agente. Verifique as credenciais.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-2xl mx-auto animate-in fade-in">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
          Cadastrar Novo Agente
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Crie as credenciais e defina a localidade da sua equipe de campo.
        </p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleCadastrar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nome Completo
              </label>
              <Input
                type="text"
                placeholder="Ex: João da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Localidade (Porto/Praia)
              </label>
              <Input
                type="text"
                placeholder="Ex: Conceição da Barra"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                E-mail de Acesso
              </label>
              <Input
                type="email"
                placeholder="agente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Senha Provisória
              </label>
              <Input
                type="text" // Mantido como text para o supervisor poder ver o que está digitando
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
          </div>

          {erro && (
            <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="text-sm font-medium text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200">
              {sucesso}
            </p>
          )}

          <div className="pt-4 border-t mt-6">
            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? "Cadastrando..." : "Cadastrar Agente"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
