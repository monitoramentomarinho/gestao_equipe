"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type RegistroDiario = {
  id: string;
  houveDesembarque?: boolean;
  qtdMonitoradas?: number;
  qtdNaoMonitoradas?: number;
  ausenciaJustificada?: boolean;
  motivoSemDesembarque?: string;
  observacoes?: string;
  situacaoPreco?: string;
  tipoColeta?: string;
  clima?: string;
  interacaoAnimais?: string;
  solicitacaoRelatorio?: boolean;
  identificacaoRelatorio?: string;
};

type DiaSemana = {
  data: string;
  diaTexto: string;
  temRegistro: boolean;
  dadosRegistro?: RegistroDiario | null;
};

export default function AgenteDashboard() {
  const [loading, setLoading] = useState(true);
  const [taxaMonitoramento, setTaxaMonitoramento] = useState(0);
  const [totalEmbarcacoes, setTotalEmbarcacoes] = useState(0);
  const [semana, setSemana] = useState<DiaSemana[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<DiaSemana | null>(null);

  async function carregarDadosDashboard(userId: string) {
    try {
      const hoje = new Date();
      const diaDaSemana = hoje.getDay();
      const diffParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;

      const segunda = new Date(hoje);
      segunda.setDate(hoje.getDate() + diffParaSegunda);
      segunda.setHours(0, 0, 0, 0);

      // --- CORREÇÃO AQUI: Criamos um limite final para a sexta-feira ---
      const sextaFim = new Date(segunda);
      sextaFim.setDate(segunda.getDate() + 4);
      sextaFim.setHours(23, 59, 59, 999);

      const diasUteis: DiaSemana[] = [];
      const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex"];

      for (let i = 0; i < 5; i++) {
        const d = new Date(segunda);
        d.setDate(segunda.getDate() + i);
        diasUteis.push({
          data: d.toISOString().split("T")[0],
          diaTexto: nomesDias[i],
          temRegistro: false,
          dadosRegistro: null,
        });
      }

      const q = query(
        collection(db, "registros_diarios"),
        where("agenteId", "==", userId),
      );
      const querySnapshot = await getDocs(q);

      let monitoradas = 0;
      let naoMonitoradas = 0;
      const registrosPorData: Record<string, RegistroDiario> = {};

      querySnapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const dataRegistroDB = dados.dataRegistro as Timestamp | undefined;
        if (!dataRegistroDB) return;

        const dataObj = dataRegistroDB.toDate();

        // --- CORREÇÃO AQUI: Verificamos se está ENTRE segunda e sexta ---
        if (dataObj >= segunda && dataObj <= sextaFim) {
          const dataString = dataObj.toISOString().split("T")[0];
          registrosPorData[dataString] = {
            id: docSnap.id,
            ...dados,
          } as RegistroDiario;

          if (dados.houveDesembarque) {
            monitoradas += dados.qtdMonitoradas || 0;
            naoMonitoradas += dados.qtdNaoMonitoradas || 0;
          }
        }
      });

      const semanaPreenchida = diasUteis.map((dia) => {
        if (registrosPorData[dia.data]) {
          return {
            ...dia,
            temRegistro: true,
            dadosRegistro: registrosPorData[dia.data],
          };
        }
        return dia;
      });

      setSemana(semanaPreenchida);

      const total = monitoradas + naoMonitoradas;
      setTotalEmbarcacoes(total);
      setTaxaMonitoramento(
        total > 0 ? Math.round((monitoradas / total) * 100) : 0,
      );
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await carregarDadosDashboard(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  function handleCliqueDia(dia: DiaSemana) {
    setDiaSelecionado(dia);
    setModalAberto(true);
  }

  if (loading)
    return (
      <div className="flex p-8 justify-center items-center flex-1">
        Carregando painel...
      </div>
    );

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-4xl mx-auto gap-6 animate-in fade-in relative">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Seu Resumo
        </h1>
        <p className="text-gray-600">
          Visão geral da sua semana atual de monitoramento.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Taxa de Monitoramento
          </h2>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-black text-blue-600">
              {taxaMonitoramento}
            </span>
            <span className="text-2xl font-bold text-blue-600">%</span>
          </div>
          <p className="text-sm text-gray-500">
            {totalEmbarcacoes > 0
              ? `Baseado em ${totalEmbarcacoes} embarcações registradas nesta semana.`
              : "Nenhuma embarcação registrada nesta semana."}
          </p>
          <div className="w-full bg-gray-100 h-3 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${taxaMonitoramento}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">
            Frequência da Semana
          </h2>
          <div className="flex justify-between items-center h-full pb-4 px-2">
            {semana.map((dia, index) => {
              const registro = dia.dadosRegistro;
              const temAusenciaJustificada =
                !!registro && registro.ausenciaJustificada;
              const semRegistro = !dia.temRegistro;

              let bolinhaClass =
                "bg-gray-50 text-gray-400 border-2 border-gray-100 hover:bg-gray-100";
              let icone = "-";

              if (temAusenciaJustificada) {
                bolinhaClass =
                  "bg-yellow-100 text-yellow-700 border-2 border-yellow-300";
                icone = "!";
              } else if (dia.temRegistro) {
                bolinhaClass =
                  "bg-green-100 text-green-700 border-2 border-green-200";
                icone = "✓";
              } else if (semRegistro) {
                bolinhaClass =
                  "bg-red-100 text-red-700 border-2 border-red-300";
                icone = "!";
              }

              return (
                <button
                  key={index}
                  onClick={() => handleCliqueDia(dia)}
                  className="flex flex-col items-center gap-2 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${bolinhaClass}`}
                  >
                    {icone}
                  </div>
                  <span
                    className={`text-xs font-semibold ${dia.temRegistro ? "text-gray-800" : "text-gray-400"}`}
                  >
                    {dia.diaTexto}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {modalAberto && diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="bg-blue-50 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-blue-900">
                Resumo de {diaSelecionado.diaTexto} (
                {diaSelecionado.data.split("-").reverse().join("/")})
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-gray-500 hover:text-gray-800 text-xl font-bold px-2"
              >
                ×
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {!diaSelecionado.temRegistro || !diaSelecionado.dadosRegistro ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhum registro foi enviado neste dia.
                </p>
              ) : (
                <div className="space-y-5 text-sm">
                  {/* BLOCO 1: Desembarque */}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Houve desembarque?</span>
                      <span className="font-semibold text-gray-800">
                        {diaSelecionado.dadosRegistro.houveDesembarque
                          ? "Sim"
                          : "Não"}
                      </span>
                    </div>
                    {diaSelecionado.dadosRegistro.houveDesembarque ? (
                      <>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-gray-600">Monitoradas:</span>
                          <span className="font-semibold text-blue-600">
                            {diaSelecionado.dadosRegistro.qtdMonitoradas}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-gray-600">
                            Não Monitoradas:
                          </span>
                          <span className="font-semibold text-gray-800">
                            {diaSelecionado.dadosRegistro.qtdNaoMonitoradas}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 border-b pb-2">
                        <span className="text-gray-600 block">Motivo:</span>
                        <p className="font-medium text-gray-800 bg-gray-50 p-2 rounded text-xs">
                          {diaSelecionado.dadosRegistro.motivoSemDesembarque ||
                            "Não informado"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* BLOCO 2: Cenário (Preço, Coleta, Clima e Animais) */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-gray-500 block mb-1">
                        Preço do Pescado:
                      </span>
                      <span className="font-semibold text-gray-800 capitalize">
                        {diaSelecionado.dadosRegistro.situacaoPreco || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">
                        Tipo de Coleta:
                      </span>
                      <span className="font-semibold text-gray-800 capitalize">
                        {diaSelecionado.dadosRegistro.tipoColeta || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-gray-500 block mb-1">Clima:</span>
                      <span className="font-semibold text-gray-800">
                        {diaSelecionado.dadosRegistro.clima || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-gray-500 block mb-1">
                        Interação Animais:
                      </span>
                      <span className="font-semibold text-gray-800 capitalize">
                        {diaSelecionado.dadosRegistro.interacaoAnimais ===
                        "sem_informacao"
                          ? "Sem Info."
                          : diaSelecionado.dadosRegistro.interacaoAnimais ||
                            "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* BLOCO 3: Solicitação de Relatório */}
                  <div className="border-b pb-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Solicitou Relatório?
                      </span>
                      <span className="font-semibold text-gray-800">
                        {diaSelecionado.dadosRegistro.solicitacaoRelatorio
                          ? "Sim"
                          : "Não"}
                      </span>
                    </div>
                    {diaSelecionado.dadosRegistro.solicitacaoRelatorio && (
                      <p className="text-xs bg-blue-50 text-blue-800 p-2 rounded mt-2 border border-blue-100">
                        <span className="font-semibold">Identificação:</span>{" "}
                        {diaSelecionado.dadosRegistro.identificacaoRelatorio ||
                          "Não informado"}
                      </p>
                    )}
                  </div>

                  {/* BLOCO 4: Observações */}
                  {diaSelecionado.dadosRegistro.observacoes && (
                    <div className="pt-1">
                      <span className="text-gray-600 block mb-1">
                        Observações:
                      </span>
                      <p className="text-gray-700 italic text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
                        “{diaSelecionado.dadosRegistro.observacoes}”
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
              {diaSelecionado.temRegistro && diaSelecionado.dadosRegistro ? (
                <Link
                  href={`/agente/form?id=${diaSelecionado.dadosRegistro.id}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    Editar Registro
                  </Button>
                </Link>
              ) : (
                <div></div>
              )}
              <button
                onClick={() => setModalAberto(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
