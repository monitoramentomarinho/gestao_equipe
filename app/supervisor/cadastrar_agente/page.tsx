"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function GerarConviteAgente() {
  const [role, setRole] = useState("agente");
  const [localidade, setLocalidade] = useState("");
  const [nomeReferencia, setNomeReferencia] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [linkGerado, setLinkGerado] = useState("");

  // Auto-preenche a localidade quando muda o nível de acesso
  function handleMudancaRole(novaRole: string) {
    setRole(novaRole);
    if (novaRole === "supervisor") {
      setLocalidade("PMCAP");
    } else if (localidade === "PMCAP") {
      setLocalidade("");
    }
  }

  async function handleGerarLink(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLinkGerado("");
    setLoading(true);

    try {
      // 1. Cria o convite no banco de dados com a role definida
      const conviteRef = await addDoc(collection(db, "convites"), {
        role: role,
        localidade: localidade.trim(),
        nomeReferencia: nomeReferencia.trim(), // Apenas para controle interno
        ativo: true,
        criadoEm: serverTimestamp(),
      });

      // 2. Monta a URL completa com o ID do documento gerado
      const urlBase = window.location.origin;
      const link = `${urlBase}/cadastro?token=${conviteRef.id}`;

      setLinkGerado(link);
      setLocalidade("");
      setNomeReferencia("");
      setRole("agente");
    } catch (err: any) {
      console.error(err);
      setErro("Erro ao gerar convite. Verifique suas permissões.");
    } finally {
      setLoading(false);
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkGerado);
    alert("Link copiado para a área de transferência!");
  }

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-2xl mx-auto animate-in fade-in">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
          Convidar Novo Usuário
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Gere um link exclusivo para a equipe realizar o próprio cadastro.
        </p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleGerarLink} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Nível de Acesso
            </label>
            <select
              value={role}
              onChange={(e) => handleMudancaRole(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="agente">Agente de Campo</option>
              <option value="supervisor">Supervisor / Gerencial</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Identificação (Opcional)
              </label>
              <Input
                type="text"
                placeholder="Nome do usuários."
                value={nomeReferencia}
                onChange={(e) => setNomeReferencia(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Localidade de Atuação
              </label>
              <Input
                type="text"
                placeholder="Ex: São Mateus"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
                required
              />
            </div>
          </div>

          {erro && (
            <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">
              {erro}
            </p>
          )}

          <div className="pt-4 border-t mt-6">
            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? "Processando..." : "Gerar Link de Cadastro"}
            </Button>
          </div>
        </form>

        {linkGerado && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg animate-in zoom-in-95">
            <h3 className="font-bold text-emerald-800 mb-2">
              Link gerado com sucesso!
            </h3>
            <p className="text-sm text-emerald-700 mb-3">
              Envie este link para o usuário. Ele só pode ser usado uma vez.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={linkGerado}
                readOnly
                className="bg-white text-slate-600 font-mono text-xs"
              />
              <Button
                onClick={copiarLink}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
              >
                Copiar
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
