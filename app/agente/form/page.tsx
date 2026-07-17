"use client";

import { useState, useEffect, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function FormularioConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idEdicao = searchParams.get("id");

  const [houveDesembarque, setHouveDesembarque] = useState<string | null>(null);
  const [motivoSemDesembarque, setMotivoSemDesembarque] = useState("");
  const [qtdMonitoradas, setQtdMonitoradas] = useState("");
  const [qtdNaoMonitoradas, setQtdNaoMonitoradas] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [situacaoPreco, setSituacaoPreco] = useState("");
  const [tipoColeta, setTipoColeta] = useState("");
  const [clima, setClima] = useState("");
  const [interacaoAnimais, setInteracaoAnimais] = useState("");
  const [solicitacaoRelatorio, setSolicitacaoRelatorio] = useState<
    string | null
  >(null);
  const [identificacaoRelatorio, setIdentificacaoRelatorio] = useState("");

  const [loadingApp, setLoadingApp] = useState(true);
  const [jaRegistrouHoje, setJaRegistrouHoje] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        if (idEdicao) {
          // MODO EDIÇÃO: Busca o documento principal
          const docRef = doc(db, "registros_diarios", idEdicao);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().agenteId === user.uid) {
            const dados = docSnap.data();

            setHouveDesembarque(dados.houveDesembarque ? "sim" : "nao");
            setMotivoSemDesembarque(dados.motivoSemDesembarque || "");
            setQtdMonitoradas(dados.qtdMonitoradas?.toString() || "");
            setQtdNaoMonitoradas(dados.qtdNaoMonitoradas?.toString() || "");
            setObservacoes(dados.observacoes || "");

            setSituacaoPreco(dados.situacaoPreco || "");
            setTipoColeta(dados.tipoColeta || "");
            setClima(dados.clima || "");
            setInteracaoAnimais(dados.interacaoAnimais || "");

            // Busca na nova coleção de relatórios de produção usando o mesmo ID
            const relatorioRef = doc(db, "relatorios_producao", idEdicao);
            const relatorioSnap = await getDoc(relatorioRef);

            if (relatorioSnap.exists()) {
              setSolicitacaoRelatorio("sim");
              setIdentificacaoRelatorio(
                relatorioSnap.data().identificacaoRelatorio || "",
              );
            } else {
              setSolicitacaoRelatorio("nao");
              setIdentificacaoRelatorio("");
            }
          }
        } else {
          const hoje = new Date().toISOString().split("T")[0];
          const q = query(
            collection(db, "registros_diarios"),
            where("agenteId", "==", user.uid),
          );
          const snaps = await getDocs(q);

          let enviouHoje = false;
          snaps.forEach((d) => {
            const dataDoc = d.data().dataRegistro?.toDate();
            if (dataDoc && dataDoc.toISOString().split("T")[0] === hoje) {
              enviouHoje = true;
            }
          });
          setJaRegistrouHoje(enviouHoje);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoadingApp(false);
      }
    });

    return () => unsubscribe();
  }, [idEdicao]);

  async function handleEnviarRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoadingBtn(true);

    if (!houveDesembarque) {
      setErro("Por favor, informe se houve ou não desembarque.");
      setLoadingBtn(false);
      return;
    }

    if (houveDesembarque === "nao" && motivoSemDesembarque.trim() === "") {
      setErro("O motivo de não ter tido desembarque é obrigatório.");
      setLoadingBtn(false);
      return;
    }

    if (houveDesembarque === "sim") {
      if (qtdMonitoradas === "" || qtdNaoMonitoradas === "") {
        setErro(
          "Informe a quantidade de embarcações. Use o número 0 caso necessário.",
        );
        setLoadingBtn(false);
        return;
      }
    }

    if (
      !situacaoPreco ||
      !tipoColeta ||
      !interacaoAnimais ||
      clima.trim() === ""
    ) {
      setErro(
        "Preencha todos os campos obrigatórios sobre o cenário de campo.",
      );
      setLoadingBtn(false);
      return;
    }

    if (!solicitacaoRelatorio) {
      setErro("Informe se houve solicitação de relatório de produção.");
      setLoadingBtn(false);
      return;
    }

    if (
      solicitacaoRelatorio === "sim" &&
      identificacaoRelatorio.trim() === ""
    ) {
      setErro(
        "É necessário identificar a embarcação/pescador que solicitou o relatório.",
      );
      setLoadingBtn(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado");

      // Objeto base da Coleção Principal (repare que retiramos os dados do relatório daqui)
      const dadosRegistro: any = {
        agenteId: user.uid,
        houveDesembarque: houveDesembarque === "sim",
        situacaoPreco,
        tipoColeta,
        clima: clima.trim(),
        interacaoAnimais,
        observacoes: observacoes.trim(),
      };

      if (houveDesembarque === "nao") {
        dadosRegistro.motivoSemDesembarque = motivoSemDesembarque.trim();
        dadosRegistro.qtdMonitoradas = null;
        dadosRegistro.qtdNaoMonitoradas = null;
      } else if (houveDesembarque === "sim") {
        dadosRegistro.qtdMonitoradas = parseInt(qtdMonitoradas) || 0;
        dadosRegistro.qtdNaoMonitoradas = parseInt(qtdNaoMonitoradas) || 0;
        dadosRegistro.motivoSemDesembarque = null;
      }

      let registroId = idEdicao;

      // 1. Salva ou atualiza a Coleção Principal (registros_diarios)
      if (idEdicao) {
        await updateDoc(doc(db, "registros_diarios", idEdicao), dadosRegistro);
      } else {
        dadosRegistro.dataRegistro = serverTimestamp();
        const novoDoc = await addDoc(
          collection(db, "registros_diarios"),
          dadosRegistro,
        );
        registroId = novoDoc.id; // Guarda o ID gerado pelo Firebase
      }

      // 2. Salva ou apaga os dados na nova Coleção (relatorios_producao)
      const relatorioRef = doc(db, "relatorios_producao", registroId as string);

      if (solicitacaoRelatorio === "sim") {
        // setDoc cria ou sobreescreve um documento num ID específico (vinculando com o registro principal)
        await setDoc(relatorioRef, {
          registroDiarioId: registroId,
          agenteId: user.uid,
          identificacaoRelatorio: identificacaoRelatorio.trim(),
          dataAtualizacao: serverTimestamp(),
        });
      } else {
        // Se for "não" (ou se alterou de sim para não), garante que nada fique salvo nessa coleção
        await deleteDoc(relatorioRef).catch(() => {}); // catch vazio pois se não existir não tem problema
      }

      // 3. Redirecionamento
      if (idEdicao) {
        router.push("/agente");
      } else {
        window.location.href = "/agente";
      }
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar o registro. Tente novamente.");
      setLoadingBtn(false);
    }
  }

  if (loadingApp) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        Carregando formulário...
      </div>
    );
  }

  if (jaRegistrouHoje && !idEdicao) {
    return (
      <main className="flex flex-col flex-1 p-6 items-center justify-center text-center max-w-md mx-auto w-full animate-in zoom-in-95">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
          ✓
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Registro Concluído
        </h2>
        <p className="text-gray-600 mb-6">
          Você já enviou o seu relatório de campo do dia de hoje.
        </p>
        <Link href="/agente">
          <Button>Voltar para o Painel</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col flex-1 p-4 sm:p-6 w-full max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          {idEdicao ? "Editar Registro" : "Novo Registro Diário"}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {idEdicao
            ? "Altere as informações abaixo e salve."
            : "Resumo quantitativo das atividades."}
        </p>
      </header>

      <form
        onSubmit={handleEnviarRegistro}
        className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 space-y-6"
      >
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <label className="text-base font-semibold text-gray-800">
            Houve desembarque?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="houve"
                value="sim"
                checked={houveDesembarque === "sim"}
                onChange={() => setHouveDesembarque("sim")}
                className="w-5 h-5 text-primary"
                required
              />
              <span>Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="houve"
                value="nao"
                checked={houveDesembarque === "nao"}
                onChange={() => setHouveDesembarque("nao")}
                className="w-5 h-5 text-primary"
                required
              />
              <span>Não</span>
            </label>
          </div>
        </div>

        {houveDesembarque === "nao" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-sm font-medium text-gray-700">
              Motivo de não ter tido desembarque
            </label>
            <Input
              placeholder="Ex: Maré baixa, mau tempo..."
              value={motivoSemDesembarque}
              onChange={(e) => setMotivoSemDesembarque(e.target.value)}
              required
            />
          </div>
        )}

        {houveDesembarque === "sim" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2 p-4 border border-blue-100 bg-blue-50/50 rounded-lg">
              <label className="text-sm font-medium text-blue-900">
                Embarcações Monitoradas
              </label>
              <Input
                type="number"
                min="0"
                placeholder="Quantidade"
                value={qtdMonitoradas}
                onChange={(e) => setQtdMonitoradas(e.target.value)}
                required
                className="bg-white"
              />
            </div>
            <div className="space-y-2 p-4 border border-gray-200 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-700">
                Não Monitoradas
              </label>
              <Input
                type="number"
                min="0"
                placeholder="Quantidade"
                value={qtdNaoMonitoradas}
                onChange={(e) => setQtdNaoMonitoradas(e.target.value)}
                required
                className="bg-white"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Situação do preço do pescado
            </label>
            <select
              value={situacaoPreco}
              onChange={(e) => setSituacaoPreco(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecione...</option>
              <option value="permaneceu">Permaneceu</option>
              <option value="aumentou">Aumentou</option>
              <option value="diminuiu">Diminuiu</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Tipo de Coleta
            </label>
            <select
              value={tipoColeta}
              onChange={(e) => setTipoColeta(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecione...</option>
              <option value="presencial">Presencial</option>
              <option value="remota">Remota</option>
              <option value="hibrida">Híbrida</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Como estava o clima no porto?
            </label>
            <Input
              placeholder="Ex: Sol forte, chuvoso, ventos fortes..."
              value={clima}
              onChange={(e) => setClima(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Interação com animais marinhos?
            </label>
            <select
              value={interacaoAnimais}
              onChange={(e) => setInteracaoAnimais(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecione...</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
              <option value="sem_informacao">Sem Informação</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <label className="text-sm font-semibold text-gray-800">
            Houve solicitação de relatório de produção?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="relatorio"
                value="sim"
                checked={solicitacaoRelatorio === "sim"}
                onChange={() => setSolicitacaoRelatorio("sim")}
                className="w-4 h-4 text-primary"
                required
              />
              <span className="text-sm">Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="relatorio"
                value="nao"
                checked={solicitacaoRelatorio === "nao"}
                onChange={() => setSolicitacaoRelatorio("nao")}
                className="w-4 h-4 text-primary"
                required
              />
              <span className="text-sm">Não</span>
            </label>
          </div>

          {solicitacaoRelatorio === "sim" && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
              <Input
                placeholder="Identifique a embarcação e/ou pescador..."
                value={identificacaoRelatorio}
                onChange={(e) => setIdentificacaoRelatorio(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-4">
          <label className="text-sm font-medium text-gray-700">
            Observações Adicionais
          </label>
          <textarea
            className="w-full min-h-20 flex rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Relate aqui qualquer ocorrência relevante do dia..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

        <Button
          type="submit"
          className="w-full h-12 text-base mt-4"
          disabled={loadingBtn}
        >
          {loadingBtn
            ? "Processando..."
            : idEdicao
              ? "Atualizar Registro"
              : "Finalizar Registro"}
        </Button>
      </form>
    </main>
  );
}

export default function FormularioRegistro() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          Carregando módulo...
        </div>
      }
    >
      <FormularioConteudo />
    </Suspense>
  );
}
