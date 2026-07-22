"use client";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function FormularioSupervisor() {
  const router = useRouter();

  const [agentes, setAgentes] = useState<
    { id: string; nome: string; localidade?: string }[]
  >([]);
  const [agenteSelecionado, setAgenteSelecionado] = useState("");
  const [dataRegistro, setDataRegistro] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [justificarAusencia, setJustificarAusencia] = useState(false);
  const [justificativaAusencia, setJustificativaAusencia] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarAgentes() {
      const q = query(collection(db, "users"), where("role", "==", "agente"));
      const snaps = await getDocs(q);
      const lista: { id: string; nome: string; localidade?: string }[] = [];
      snaps.forEach((doc) => {
        const dados = doc.data();
        lista.push({
          id: doc.id,
          nome: dados.nome || "Agente sem nome",
          localidade: dados.localidade,
        });
      });
      setAgentes(lista);
    }

    carregarAgentes();
  }, []);

  async function handleEnviarRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    if (!agenteSelecionado) {
      setErro("Selecione um agente responsável.");
      setLoading(false);
      return;
    }

    if (justificarAusencia && justificativaAusencia.trim() === "") {
      setErro("Descreva a justificativa para a ausência.");
      setLoading(false);
      return;
    }

    try {
      const usuario = auth.currentUser;
      if (!usuario) {
        throw new Error("Usuário não autenticado");
      }

      const dataParaSalvar = new Date(`${dataRegistro}T12:00:00`);
      const dadosRegistro: Record<string, unknown> = {
        agenteId: agenteSelecionado,
        registradoPorSupervisor: true,
        supervisorId: usuario.uid,
        dataRegistro: Timestamp.fromDate(dataParaSalvar),
        houveDesembarque: false,
        observacoes: justificativaAusencia.trim()
          ? `Registro de ausência justificada pelo supervisor: ${justificativaAusencia.trim()}`
          : "Registro enviado pelo supervisor.",
        ausenciaJustificada: justificarAusencia,
        justificativaAusencia: justificativaAusencia.trim(),
        solicitacaoRelatorio: false,
        identificacaoRelatorio: null,
      };

      await addDoc(collection(db, "registros_diarios"), dadosRegistro);
      router.push("/supervisor");
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar o registro. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">
        Registro do supervisor
      </h1>
      <form
        onSubmit={handleEnviarRegistro}
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6"
      >
        <div className="space-y-2 pb-4 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-800">
            Agente responsável
          </label>
          <select
            className="w-full border border-slate-200 rounded-md bg-slate-50 p-2.5 text-slate-800"
            value={agenteSelecionado}
            onChange={(e) => setAgenteSelecionado(e.target.value)}
            required
          >
            <option value="">Selecione o agente</option>
            {agentes.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.nome} {ag.localidade ? `- ${ag.localidade}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">
            Data do registro
          </label>
          <input
            type="date"
            value={dataRegistro}
            onChange={(e) => setDataRegistro(e.target.value)}
            className="w-full border border-slate-200 rounded-md bg-slate-50 p-2.5 text-slate-800"
            required
          />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm font-semibold text-slate-800">
            Justificar ausência?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="ausencia"
                checked={justificarAusencia}
                onChange={() => setJustificarAusencia(true)}
              />
              Sim
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="ausencia"
                checked={!justificarAusencia}
                onChange={() => {
                  setJustificarAusencia(false);
                  setJustificativaAusencia("");
                }}
              />
              Não
            </label>
          </div>

          {justificarAusencia && (
            <div>
              <textarea
                className="w-full border border-slate-200 rounded-md p-2.5 text-sm text-slate-800"
                placeholder="Explique a ausência do agente e o motivo da justificativa"
                value={justificativaAusencia}
                onChange={(e) => setJustificativaAusencia(e.target.value)}
                rows={4}
              />

              <span className="text-xs text-slate-500 flex items-center gap-2">
                O documento que justifica a ausência do agente deve ser enviado
                para o email: monitoramentomarinho@gmail.com
              </span>
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Salvando..." : "Registrar"}
        </Button>
      </form>
    </main>
  );
}
