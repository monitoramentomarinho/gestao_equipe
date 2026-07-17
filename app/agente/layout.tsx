"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AgenteLayout({
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
    <div className="min-h-screen flex flex-col bg-blue-50">
      {/* Cabeçalho Responsivo */}
      <header className="bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
        <div className="font-bold text-lg text-blue-900 w-full sm:w-auto text-center sm:text-left">
          PMAP - Área do Agente
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Link
            href="/agente"
            className="text-sm font-medium text-gray-600 hover:text-blue-600 p-2"
          >
            Início
          </Link>
          <Link href="/agente/formulario">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Novo Registro
            </Button>
          </Link>

          {/* Novo Botão de Perfil */}
          <Link href="/agente/perfil">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-blue-600"
            >
              Meu Perfil
            </Button>
          </Link>

          <Button variant="ghost" size="sm" onClick={handleSair}>
            Sair
          </Button>
        </nav>
      </header>

      {/* Área principal das páginas */}
      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}
