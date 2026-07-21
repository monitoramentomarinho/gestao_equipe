"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

function FormularioCadastro() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [conviteValido, setConviteValido] = useState<boolean | null>(null);
  const [localidadeDefinida, setLocalidadeDefinida] = useState("");
  const [roleDefinida, setRoleDefinida] = useState("agente");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function validarToken() {
      if (!token) {
        setConviteValido(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "convites", token));
        if (snap.exists() && snap.data().ativo === true) {
          setLocalidadeDefinida(snap.data().localidade);
          // Caso existam convites velhos sem role, o padrão será "agente"
          setRoleDefinida(snap.data().role || "agente");
          setConviteValido(true);
        } else {
          setConviteValido(false);
        }
      } catch (err) {
        setConviteValido(false);
      }
    }
    validarToken();
  }, [token]);

  async function handleFinalizarCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    if (senha.length < 6) {
      setErro("Sua senha precisa ter no mínimo 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);

      // Salva o perfil definindo a role dinâmica (agente ou supervisor)
      await setDoc(doc(db, "users", cred.user.uid), {
        nome: nome.trim(),
        email: email.trim(),
        localidade: localidadeDefinida,
        role: roleDefinida,
        dataCriacao: serverTimestamp(),
      });

      await updateDoc(doc(db, "convites", token!), {
        ativo: false,
        usadoPor: email,
        usadoEm: serverTimestamp(),
      });

      // Direciona para o painel correto com base no nível de acesso
      if (roleDefinida === "supervisor") {
        router.push("/supervisor");
      } else {
        router.push("/agente");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setErro("Este e-mail já está sendo usado.");
      } else {
        setErro("Erro ao finalizar cadastro. Tente novamente.");
      }
      setLoading(false);
    }
  }

  if (conviteValido === null)
    return (
      <div className="p-10 text-center">Verificando link de convite...</div>
    );
  if (conviteValido === false)
    return (
      <div className="flex flex-1 items-center justify-center p-4 min-h-screen bg-slate-50">
        <div className="w-full max-w-md p-8 text-center bg-white rounded-xl shadow-lg border border-red-100">
          <h1 className="text-xl font-bold text-red-600 mb-2">
            Link Inválido ou Expirado
          </h1>
          <p className="text-slate-600">
            Este link de cadastro não existe ou já foi utilizado por outra
            pessoa. Solicite um novo link.
          </p>
        </div>
      </div>
    );

  return (
    <div className="flex flex-1 items-center justify-center p-4 min-h-screen bg-blue-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-blue-100 animate-in fade-in zoom-in-95">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Finalizar Cadastro
          </h1>
          <p className="text-sm text-gray-500">
            Você foi convidado(a) para atuar na localidade:{" "}
            <strong className="text-blue-600">{localidadeDefinida}</strong>
            {roleDefinida === "supervisor" && " (Acesso Gerencial)"}.
          </p>
        </div>

        <form onSubmit={handleFinalizarCadastro} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Seu Nome Completo
            </label>
            <Input
              type="text"
              placeholder="Digite seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Seu Melhor E-mail
            </label>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Crie uma Senha
            </label>
            <Input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded-md">
              {erro}
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Criando conta..." : "Criar minha conta e Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function PaginaDeCadastro() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Carregando...</div>}>
      <FormularioCadastro />
    </Suspense>
  );
}
