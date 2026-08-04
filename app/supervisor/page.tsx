"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";

type Agente = { id: string; nome: string; localidade: string };
type Registro = {
  id: string;
  agenteId: string;
  nome?: string;
  dataRegistro?: Timestamp | null;
  enviadoEm?: Timestamp | null;
  registradoPorSupervisor?: boolean;
  houveDesembarque?: boolean;
  qtdMonitoradas?: number | null;
  qtdNaoMonitoradas?: number | null;
  motivoSemDesembarque?: string | null;
  observacoes?: string | null;
  justificativaAusencia?: string | null;
  ausenciaJustificada?: boolean;
  urlComprovante?: string | null;
  situacaoPreco?: string | null;
  tipoColeta?: string | null;
  clima?: string | null;
  interacaoAnimais?: string | null;
};
type DiaCalendario = {
  data: string;
  diaTexto: string;
  numero: number;
  doMes: boolean;
  temRegistro: boolean;
  dadosRegistro?: Registro;
};
type SemanaMes = {
  id: string;
  label: string;
  dias: DiaCalendario[];
};
type MesVisao = {
  key: string;
  label: string;
  semanas: SemanaMes[];
};

const normalizarTexto = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const construirMesVisao = (key: string, registrosDoAgente: Registro[]) => {
  const [anoTexto, mesTexto] = key.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto) - 1;
  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0);

  const inicioSemana = new Date(inicioMes);
  const diff = inicioSemana.getDay() === 0 ? -6 : 1 - inicioSemana.getDay();
  inicioSemana.setDate(inicioMes.getDate() + diff);

  const semanas: SemanaMes[] = [];
  const cursor = new Date(inicioSemana);
  let semanaIndex = 1;

  while (cursor <= fimMes) {
    const semana: DiaCalendario[] = [];

    for (let i = 0; i < 7; i += 1) {
      const data = new Date(cursor);
      const ehDoMes = data.getMonth() === mes;

      const diaDaSemana = data.getDay();
      const ehDiaUtil = diaDaSemana >= 1 && diaDaSemana <= 5;

      const dataKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

      const registroDoDia = registrosDoAgente.find((item) => {
        const dataItem = item.dataRegistro?.toDate();
        if (!dataItem) return false;
        const chaveItem = `${dataItem.getFullYear()}-${String(dataItem.getMonth() + 1).padStart(2, "0")}-${String(dataItem.getDate()).padStart(2, "0")}`;
        return chaveItem === dataKey;
      });

      if (ehDiaUtil) {
        semana.push({
          data: dataKey,
          diaTexto: data.toLocaleDateString("pt-BR", { weekday: "short" }),
          numero: data.getDate(),
          doMes: ehDoMes,
          temRegistro: Boolean(registroDoDia),
          dadosRegistro: registroDoDia,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const temDiaNoMesAtual = semana.some((dia) => dia.doMes);

    if (temDiaNoMesAtual) {
      semanas.push({
        id: `${key}-semana-${semanaIndex}`,
        label: `Semana ${semanaIndex}`,
        dias: semana,
      });
      semanaIndex += 1;
    }
  }

  const label = inicioMes.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return {
    key,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    semanas,
  } as MesVisao;
};

export default function SupervisorDashboard() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [relatoriosMap, setRelatoriosMap] = useState<
    Record<string, { identificacaoRelatorio?: string }>
  >({});

  const [loading, setLoading] = useState(true);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [pesquisaEmFoco, setPesquisaEmFoco] = useState(false);
  const [agenteSelecionado, setAgenteSelecionado] = useState<Agente | null>(
    null,
  );
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<DiaCalendario | null>(
    null,
  );
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [semanaSelecionada, setSemanaSelecionada] = useState<SemanaMes | null>(
    null,
  );

  // Estados para o Modal de CSV
  const [modalCsvAberto, setModalCsvAberto] = useState(false);
  const [csvAgentesSelecionados, setCsvAgentesSelecionados] = useState<
    Agente[]
  >([]);
  const [csvDataInicio, setCsvDataInicio] = useState("");
  const [csvDataFim, setCsvDataFim] = useState("");
  const [csvGerando, setCsvGerando] = useState(false);
  const [erroCsv, setErroCsv] = useState("");

  useEffect(() => {
    let agentesCarregados: Agente[] = [];

    async function carregarDadosIniciais() {
      try {
        const qAgentes = query(
          collection(db, "users"),
          where("role", "==", "agente"),
        );
        const snapsAgentes = await getDocs(qAgentes);
        const listaAgentes: Agente[] = [];
        snapsAgentes.forEach((doc) => {
          const dados = doc.data();
          listaAgentes.push({
            id: doc.id,
            nome: dados.nome || "Agente sem nome",
            localidade: dados.localidade || "Sem localidade",
          });
        });
        agentesCarregados = listaAgentes;
        setAgentes(listaAgentes);
      } catch (err) {
        console.error("Erro ao buscar agentes", err);
      }
    }

    carregarDadosIniciais();

    const unsubscribeRegistros = onSnapshot(
      collection(db, "registros_diarios"),
      (snapshot) => {
        const lista: Registro[] = [];
        snapshot.forEach((doc) => {
          const dados = doc.data();
          const agenteInfo = agentesCarregados.find(
            (ag) => ag.id === dados.agenteId,
          );
          lista.push({
            id: doc.id,
            agenteId: dados.agenteId,
            nome: agenteInfo ? agenteInfo.nome : "Agente não identificado",
            ...dados,
          } as Registro);
        });
        setRegistros(lista);
        setLoading(false);
      },
    );

    const unsubscribeRelatorios = onSnapshot(
      collection(db, "relatorios_producao"),
      (snapshot) => {
        const mapa: Record<string, { identificacaoRelatorio?: string }> = {};
        snapshot.forEach((doc) => {
          const dados = doc.data();
          mapa[doc.id] = {
            identificacaoRelatorio:
              typeof dados.identificacaoRelatorio === "string"
                ? dados.identificacaoRelatorio
                : undefined,
          };
        });
        setRelatoriosMap(mapa);
      },
    );

    return () => {
      unsubscribeRegistros();
      unsubscribeRelatorios();
    };
  }, []);

  const agentesFiltrados = useMemo(() => {
    if (!termoPesquisa.trim()) return agentes;
    return agentes.filter((agente) =>
      normalizarTexto(agente.nome).includes(normalizarTexto(termoPesquisa)),
    );
  }, [agentes, termoPesquisa]);

  const registrosDoAgente = useMemo(() => {
    if (!agenteSelecionado) return [];
    return registros.filter(
      (registro) => registro.agenteId === agenteSelecionado.id,
    );
  }, [agenteSelecionado, registros]);

  const mesesDisponiveis = useMemo(() => {
    const mapa = new Map<string, MesVisao>();

    registrosDoAgente.forEach((registro) => {
      const dataRegistro = registro.dataRegistro?.toDate();
      if (!dataRegistro) return;

      const ano = dataRegistro.getFullYear();
      const mes = dataRegistro.getMonth();
      const mesKey = `${ano}-${String(mes + 1).padStart(2, "0")}`;
      if (!mapa.has(mesKey)) {
        mapa.set(mesKey, construirMesVisao(mesKey, registrosDoAgente));
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [registrosDoAgente]);

  const mesSelecionadoAtivo = mesSelecionado || mesesDisponiveis[0]?.key || "";

  const mesAtivo = useMemo(() => {
    if (!agenteSelecionado || !mesSelecionadoAtivo) return null;
    return construirMesVisao(mesSelecionadoAtivo, registrosDoAgente);
  }, [agenteSelecionado, mesSelecionadoAtivo, registrosDoAgente]);

  const abrirDetalhesDoDia = (dia: DiaCalendario) => {
    setDiaSelecionado(dia);
    setModalDetalhesAberto(true);
  };

  const gerarCsv = () => {
    setCsvGerando(true);
    try {
      // Define os agentes que serão exportados: os selecionados, ou TODOS se a lista estiver vazia
      const agentesParaExportar =
        csvAgentesSelecionados.length > 0 ? csvAgentesSelecionados : agentes;
      const idsParaExportar = agentesParaExportar.map((a) => a.id);

      const registrosCsv = registros.filter((registro) => {
        const dataRegistro = registro.dataRegistro?.toDate();
        if (!dataRegistro) return false;

        // Verifica se o registro pertence a um dos agentes no filtro
        if (!idsParaExportar.includes(registro.agenteId)) return false;

        const inicio = csvDataInicio
          ? new Date(`${csvDataInicio}T00:00:00`)
          : null;
        const fim = csvDataFim ? new Date(`${csvDataFim}T23:59:59`) : null;
        return (
          (!inicio || dataRegistro >= inicio) && (!fim || dataRegistro <= fim)
        );
      });

      if (registrosCsv.length === 0) {
        setErroCsv("Nenhum registro encontrado para este filtro.");
        setCsvGerando(false);
        return;
      }

      const BOM = "\uFEFF";
      const delimitador = ";";
      const linhas = [
        [
          "Data (Referência)",
          "Hora de Envio",
          "Mês",
          "Ano",
          "Agente",
          "Status",
          "Houve Desembarque",
          "Num de descargas",
          "Num de monitoradas",
          "Num de não monitoradas",
          "Situação do Preço",
          "Tipo de coleta",
          "Clima",
          "Interação com animais marinhos",
          "Solicitação de relatórios",
          "Motivo sem desembarque",
          "Observações",
          "Justificativa Ausência",
          "Link do Comprovante",
        ]
          .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
          .join(delimitador),
      ];

      // Ordenar os registros por data antes de gerar as linhas
      registrosCsv.sort((a, b) => {
        const dataA = a.dataRegistro?.toMillis() || 0;
        const dataB = b.dataRegistro?.toMillis() || 0;
        return dataA - dataB;
      });

      registrosCsv.forEach((registro) => {
        const dataRegistro = registro.dataRegistro?.toDate();
        let dataStr = "Sem data";
        let mes = "";
        let ano = "";

        if (dataRegistro) {
          dataStr = dataRegistro.toLocaleDateString("pt-BR");
          mes = String(dataRegistro.getMonth() + 1).padStart(2, "0");
          ano = String(dataRegistro.getFullYear());
        }

        let horaEnvio = "N/A";
        if (registro.enviadoEm) {
          horaEnvio = registro.enviadoEm.toDate().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        const mon = registro.qtdMonitoradas || 0;
        const naoMon = registro.qtdNaoMonitoradas || 0;
        const totalDescargas = mon + naoMon;

        let animais = "N/A";
        if (registro.interacaoAnimais === "sim") animais = "Sim";
        else if (registro.interacaoAnimais === "nao") animais = "Não";
        else if (registro.interacaoAnimais === "sem_informacao")
          animais = "Sem Informação";

        const relatorioVinculado = relatoriosMap[registro.id];

        // Pega o nome do agente atual iterado
        const nomeDoAgenteAtual =
          agentes.find((a) => a.id === registro.agenteId)?.nome ||
          "Agente Desconhecido";

        const linha = [
          dataStr,
          horaEnvio,
          mes,
          ano,
          nomeDoAgenteAtual,
          registro.ausenciaJustificada
            ? "ausencia_justificada"
            : registro.registradoPorSupervisor
              ? "gerencial"
              : "agente",
          registro.houveDesembarque ? "Sim" : "Não",
          totalDescargas,
          mon,
          naoMon,
          registro.situacaoPreco || "N/A",
          registro.tipoColeta || "N/A",
          registro.clima || "N/A",
          animais,
          relatorioVinculado ? "Sim" : "Não",
          (registro.motivoSemDesembarque || "").replace(/\n/g, " "),
          (registro.observacoes || "").replace(/\n/g, " "),
          (registro.justificativaAusencia || "").replace(/\n/g, " "),
          registro.urlComprovante || "N/A",
        ]
          .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
          .join(delimitador);
        linhas.push(linha);
      });

      const blob = new Blob([BOM + linhas.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Nome do arquivo inteligente
      let nomeArquivo = "relatorio_geral_agentes";
      if (csvAgentesSelecionados.length === 1) {
        nomeArquivo = `relatorio_${csvAgentesSelecionados[0].nome.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      } else if (csvAgentesSelecionados.length > 1) {
        nomeArquivo = "relatorio_multiplos_agentes";
      }

      link.download = `${nomeArquivo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setModalCsvAberto(false);
      setErroCsv("");
    } finally {
      setCsvGerando(false);
    }
  };

  const limparSelecao = () => {
    setAgenteSelecionado(null);
    setTermoPesquisa("");
    setMesSelecionado("");
    setSemanaSelecionada(null);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-600">Carregando painel...</div>
    );
  }

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-6xl mx-auto gap-6">
      <header className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Supervisão de equipe
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Busque pelo nome do agente, acompanhe suas semanas e exporte os
              registros em CSV.
            </p>
          </div>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              // Se o supervisor já estiver olhando os dados de um agente específico,
              // já trazemos ele pré-selecionado para facilitar. Senão, fica vazio (todos).
              setCsvAgentesSelecionados(
                agenteSelecionado ? [agenteSelecionado] : [],
              );
              setCsvDataInicio("");
              setCsvDataFim("");
              setErroCsv("");
              setModalCsvAberto(true);
            }}
          >
            Gerar CSV
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-semibold text-slate-700">
            Buscar agente
          </label>
          <input
            value={termoPesquisa}
            onChange={(event) => setTermoPesquisa(event.target.value)}
            onFocus={() => setPesquisaEmFoco(true)}
            onBlur={() => setPesquisaEmFoco(false)}
            placeholder="Digite o nome do agente"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
          />
        </div>

        {pesquisaEmFoco && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            {agentesFiltrados.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum agente encontrado com esse nome.
              </p>
            ) : (
              agentesFiltrados.map((agente) => (
                <button
                  key={agente.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setAgenteSelecionado(agente);
                    setTermoPesquisa(agente.nome);
                    setMesSelecionado("");
                    setSemanaSelecionada(null);
                    setPesquisaEmFoco(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm"
                >
                  <span>{agente.nome}</span>
                  <span className="text-xs text-slate-500">
                    {agente.localidade}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </header>

      {agenteSelecionado && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {agenteSelecionado.nome}
                </h2>
                <p className="text-sm text-slate-500">
                  {agenteSelecionado.localidade}
                </p>
              </div>
              <Button
                variant="outline"
                className="border-slate-200 text-slate-700"
                onClick={limparSelecao}
              >
                Trocar agente
              </Button>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Meses e semanas
                </h3>
                <p className="text-sm text-slate-500">
                  Selecione um mês e depois uma semana para ver os detalhes.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {mesesDisponiveis.map((mes) => (
                  <button
                    key={mes.key}
                    onClick={() => {
                      setMesSelecionado(mes.key);
                      setSemanaSelecionada(null);
                    }}
                    className={`rounded-full border px-3 py-2 text-sm font-medium ${mes.key === mesSelecionadoAtivo ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-700 bg-white"}`}
                  >
                    Mês atual
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <label className="text-sm font-semibold text-slate-700">
                  Buscar outro mês:
                </label>
                <input
                  type="month"
                  value={mesSelecionadoAtivo}
                  onChange={(event) => {
                    setMesSelecionado(event.target.value);
                    setSemanaSelecionada(null);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                />
              </div>
            </div>

            {mesAtivo && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {mesAtivo.semanas.map((semana) => (
                  <button
                    key={semana.id}
                    onClick={() => setSemanaSelecionada(semana)}
                    className={`rounded-xl border p-4 text-left transition ${semanaSelecionada?.id === semana.id ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {semana.label}
                      </span>
                      <span className="text-sm text-slate-500">
                        {semana.dias.filter((dia) => dia.temRegistro).length}{" "}
                        dias com registro
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {semanaSelecionada && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {semanaSelecionada.label}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Status diário da semana selecionada.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700"
                  onClick={() => setSemanaSelecionada(null)}
                >
                  Ocultar semana
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {semanaSelecionada.dias.map((dia) => {
                  const registro = dia.dadosRegistro;
                  const temAusenciaJustificada =
                    !!registro?.ausenciaJustificada;
                  let bolinhaClass =
                    "bg-red-100 text-red-700 border border-red-200";
                  let icone = "!";

                  if (temAusenciaJustificada) {
                    bolinhaClass =
                      "bg-yellow-100 text-yellow-700 border border-yellow-300";
                    icone = "!";
                  } else if (dia.temRegistro) {
                    bolinhaClass =
                      "bg-emerald-100 text-emerald-700 border border-emerald-200";
                    icone = "✓";
                  }

                  return (
                    <button
                      key={dia.data}
                      onClick={() => abrirDetalhesDoDia(dia)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${bolinhaClass}`}
                      >
                        {icone}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        {dia.numero}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {dia.diaTexto}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {!agenteSelecionado && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Digite o nome de um agente para visualizar suas semanas e registros.
        </section>
      )}

      {modalDetalhesAberto && diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800">
                Detalhes do dia -{" "}
                {diaSelecionado.data.split("-").reverse().join("/")}
              </h3>
              <button
                onClick={() => setModalDetalhesAberto(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold px-2"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm overflow-y-auto">
              {!diaSelecionado.temRegistro ? (
                <p className="text-slate-500 text-center py-4">
                  Nenhum registro encontrado para este dia.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex justify-between items-center">
                    <div>
                      <p className="text-slate-600">Status</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.ausenciaJustificada
                          ? "Ausência justificada"
                          : diaSelecionado.dadosRegistro
                                ?.registradoPorSupervisor
                            ? "Registro gerencial"
                            : "Registro do agente"}
                      </p>
                    </div>

                    {diaSelecionado.dadosRegistro?.enviadoEm && (
                      <div className="text-right">
                        <p className="text-slate-600">Enviado às</p>
                        <p className="font-bold text-slate-800 mt-1">
                          {diaSelecionado.dadosRegistro.enviadoEm
                            .toDate()
                            .toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Houve desembarque?</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.houveDesembarque
                          ? "Sim"
                          : "Não"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Monitoradas</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.qtdMonitoradas ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Não monitoradas</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.qtdNaoMonitoradas ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Motivo</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.motivoSemDesembarque ||
                          "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Situação do preço</p>
                      <p className="font-semibold text-slate-800 mt-1 capitalize">
                        {diaSelecionado.dadosRegistro?.situacaoPreco || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Tipo de coleta</p>
                      <p className="font-semibold text-slate-800 mt-1 capitalize">
                        {diaSelecionado.dadosRegistro?.tipoColeta || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Clima</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {diaSelecionado.dadosRegistro?.clima || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-500">Interação com animais</p>
                      <p className="font-semibold text-slate-800 mt-1 capitalize">
                        {diaSelecionado.dadosRegistro?.interacaoAnimais ===
                        "sem_informacao"
                          ? "Sem Informação"
                          : diaSelecionado.dadosRegistro?.interacaoAnimais ||
                            "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mt-3">
                    <p className="text-blue-800 font-semibold mb-1">
                      Solicitação de relatório de produção?
                    </p>
                    {relatoriosMap[diaSelecionado.dadosRegistro?.id || ""] ? (
                      <>
                        <p className="font-bold text-blue-900 mt-1">Sim</p>
                        <p className="text-sm text-blue-700 mt-2">
                          <span className="font-semibold">Identificação: </span>
                          {
                            relatoriosMap[
                              diaSelecionado.dadosRegistro?.id || ""
                            ].identificacaoRelatorio
                          }
                        </p>
                      </>
                    ) : (
                      <p className="font-bold text-blue-900 mt-1">Não</p>
                    )}
                  </div>

                  {diaSelecionado.dadosRegistro?.justificativaAusencia && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col items-start gap-2">
                      <div className="w-full">
                        <p className="text-amber-700 font-semibold">
                          Justificativa da ausência
                        </p>
                        <p className="text-slate-700 mt-1">
                          {diaSelecionado.dadosRegistro.justificativaAusencia}
                        </p>
                      </div>

                      {diaSelecionado.dadosRegistro.urlComprovante && (
                        <a
                          href={diaSelecionado.dadosRegistro.urlComprovante}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-colors"
                        >
                          Visualizar Comprovante / Atestado
                        </a>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-slate-500">Observações</p>
                    <p className="font-semibold text-slate-800 mt-1">
                      {diaSelecionado.dadosRegistro?.observacoes ||
                        "Sem observações"}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <Button
                variant="outline"
                className="border-slate-200 text-slate-700"
                onClick={() => setModalDetalhesAberto(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalCsvAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">
                Exportar relatório CSV
              </h3>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Agentes{" "}
                  <span className="text-xs font-normal text-slate-500">
                    (Vazio = Todos os agentes)
                  </span>
                </label>

                {/* Renderização das Tags dos Agentes Selecionados */}
                {csvAgentesSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                    {csvAgentesSelecionados.map((agente) => (
                      <span
                        key={agente.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full border border-emerald-200 shadow-sm"
                      >
                        {agente.nome}
                        <button
                          onClick={() => {
                            setCsvAgentesSelecionados(
                              csvAgentesSelecionados.filter(
                                (a) => a.id !== agente.id,
                              ),
                            );
                          }}
                          className="text-emerald-600 hover:text-emerald-900 transition-colors focus:outline-none"
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown multi-seleção de Agentes */}
                <select
                  value="" // Mantém no placeholder para sempre ser um seletor de ações
                  onChange={(event) => {
                    const idSelecionado = event.target.value;
                    if (!idSelecionado) return;

                    const agenteAdicionado = agentes.find(
                      (a) => a.id === idSelecionado,
                    );
                    if (
                      agenteAdicionado &&
                      !csvAgentesSelecionados.find(
                        (a) => a.id === idSelecionado,
                      )
                    ) {
                      setCsvAgentesSelecionados([
                        ...csvAgentesSelecionados,
                        agenteAdicionado,
                      ]);
                    }
                  }}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Selecione para adicionar à lista...</option>
                  {agentes
                    .filter(
                      (agente) =>
                        !csvAgentesSelecionados.find(
                          (selecionado) => selecionado.id === agente.id,
                        ),
                    )
                    .map((agente) => (
                      <option key={agente.id} value={agente.id}>
                        {agente.nome}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={csvDataInicio}
                    onChange={(event) => setCsvDataInicio(event.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={csvDataFim}
                    onChange={(event) => setCsvDataFim(event.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
              <span className="text-xs text-slate-500 flex items-center gap-2">
                <Info className="w-3 shrink-0" />
                Para obter todo o histórico disponível, mantenha as datas em
                branco.
              </span>

              {erroCsv && (
                <p className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                  {erroCsv}
                </p>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="border-slate-200 text-slate-700"
                onClick={() => setModalCsvAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={gerarCsv}
                disabled={csvGerando}
              >
                {csvGerando ? "Gerando..." : "Gerar CSV"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
