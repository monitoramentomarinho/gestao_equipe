"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleSair() {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 border-b px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
        <div className="font-bold text-lg text-white w-full sm:w-auto text-center sm:text-left">
          Painel do Supervisor
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Link
            href="/supervisor"
            className="text-sm font-medium text-white hover:text-blue-600 p-2"
          >
            Início
          </Link>
          <Link href="/supervisor/form">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Novo Registro
            </Button>
          </Link>

          {/* Novo Botão de Perfil */}
          <Link
            href="/perfil"
            className="text-sm font-medium text-white hover:text-blue-600 p-2"
          >
            Meu perfil
          </Link>

          {/* Novo Botão para Cadastrar Agente */}
          <Link href="/supervisor/cadastrar_agente">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Cadastrar Agente
            </Button>
          </Link>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleSair}
            className="bg-white"
          >
            Sair
          </Button>
        </nav>
      </header>

      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}
