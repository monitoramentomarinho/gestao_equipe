"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

type RelatorioPedido = {
  id: string;
  agenteNome: string;
  identificacao: string;
  dataRegistro?: Timestamp | null;
  relatorioConcluido?: boolean;
  relatorioEntregue?: boolean;
};

const formatarData = (valor?: Timestamp | null) => {
  if (!valor) return "Sem data";
  const data = valor.toDate();
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function RelatorioProducaoPage() {
  const [pedidos, setPedidos] = useState<RelatorioPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "registros_diarios"),
      (snapshot) => {
        const lista: RelatorioPedido[] = [];
        snapshot.forEach((docSnap) => {
          const dados = docSnap.data();
          if (!dados.solicitacaoRelatorio) return;

          lista.push({
            id: docSnap.id,
            agenteNome: dados.nome || dados.agenteNome || "Agente",
            identificacao:
              dados.identificacaoRelatorio || "Identificação não informada",
            dataRegistro: dados.dataRegistro,
            relatorioConcluido: Boolean(dados.relatorioConcluido),
            relatorioEntregue: Boolean(dados.relatorioEntregue),
          });
        });

        setPedidos(
          lista.sort(
            (a, b) =>
              (b.dataRegistro?.toDate().getTime() || 0) -
              (a.dataRegistro?.toDate().getTime() || 0),
          ),
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const atualizarStatus = async (
    id: string,
    campo: "relatorioConcluido" | "relatorioEntregue",
  ) => {
    setProcessandoId(id);
    try {
      await updateDoc(doc(db, "registros_diarios", id), {
        [campo]: true,
      });
    } catch (error) {
      console.error("Erro ao atualizar relatório:", error);
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-6xl mx-auto gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Pedidos de relatório de produção
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Acompanhe os pedidos recebidos e marque quando o relatório foi
              concluído e entregue.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Carregando pedidos...
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nenhum pedido de relatório encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => {
            const entregue = pedido.relatorioEntregue;
            const concluido = pedido.relatorioConcluido;

            return (
              <article
                key={pedido.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-800">
                        {pedido.agenteNome}
                      </h2>
                      {concluido && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Concluído
                        </span>
                      )}
                      {entregue && (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                          Entregue
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {pedido.identificacao}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatarData(pedido.dataRegistro)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-200 text-slate-700"
                      disabled={concluido || processandoId === pedido.id}
                      onClick={() =>
                        atualizarStatus(pedido.id, "relatorioConcluido")
                      }
                    >
                      {concluido ? "Concluído" : "Marcar como concluído"}
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={entregue || processandoId === pedido.id}
                      onClick={() =>
                        atualizarStatus(pedido.id, "relatorioEntregue")
                      }
                    >
                      {entregue ? "Entregue" : "Marcar como entregue"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
