"use client";

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
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

// --- FUNÇÃO PARA COMPRIMIR IMAGENS NO NAVEGADOR ---
const comprimirImagem = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = height * (MAX_WIDTH / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"),
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                },
              );
              resolve(newFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.7,
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function FormularioSupervisor() {
  const CLOUDINARY_CLOUD_NAME = "nswds35z";
  const CLOUDINARY_UPLOAD_PRESET = "pmap_atestados";
  const router = useRouter();

  const [agentes, setAgentes] = useState<
    { id: string; nome: string; localidade?: string }[]
  >([]);
  const [agenteSelecionado, setAgenteSelecionado] = useState("");

  const [dataRegistro, setDataRegistro] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dataFim, setDataFim] = useState("");

  const [justificarAusencia, setJustificarAusencia] = useState(false);
  const [tipoAusencia, setTipoAusencia] = useState<
    "atestado" | "ferias" | "outro" | ""
  >("");
  const [justificativaAusencia, setJustificativaAusencia] = useState("");
  const [arquivoAtestado, setArquivoAtestado] = useState<File | null>(null);

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

    if (justificarAusencia) {
      if (!tipoAusencia) {
        setErro("Selecione o tipo de justificativa.");
        setLoading(false);
        return;
      }

      if (tipoAusencia === "outro" && justificativaAusencia.trim() === "") {
        setErro("Descreva o motivo da ausência.");
        setLoading(false);
        return;
      }

      if (
        (tipoAusencia === "atestado" || tipoAusencia === "outro") &&
        !arquivoAtestado
      ) {
        setErro(
          "É obrigatório anexar o documento comprobatório para este tipo de ausência.",
        );
        setLoading(false);
        return;
      }

      if (!dataFim) {
        setErro("A data final do período de ausência é obrigatória.");
        setLoading(false);
        return;
      }
    }

    try {
      const usuario = auth.currentUser;
      if (!usuario) {
        throw new Error("Usuário não autenticado");
      }

      const datasParaSalvar: Date[] = [];
      const atual = new Date(`${dataRegistro}T12:00:00`);
      const final = justificarAusencia
        ? new Date(`${dataFim}T12:00:00`)
        : new Date(`${dataRegistro}T12:00:00`);

      if (final < atual) {
        setErro("A data final não pode ser anterior à data inicial.");
        setLoading(false);
        return;
      }

      while (atual <= final) {
        const diaSemana = atual.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) {
          datasParaSalvar.push(new Date(atual));
        }
        atual.setDate(atual.getDate() + 1);
      }

      if (datasParaSalvar.length === 0) {
        setErro(
          "O período selecionado cai apenas em fins de semana. Selecione um dia útil.",
        );
        setLoading(false);
        return;
      }

      let urlComprovanteSalva = null;

      // Upload apenas se houver arquivo (Atestado ou Outro)
      if (
        justificarAusencia &&
        arquivoAtestado &&
        (tipoAusencia === "atestado" || tipoAusencia === "outro")
      ) {
        const arquivoComprimido = await comprimirImagem(arquivoAtestado);

        const formData = new FormData();
        formData.append("file", arquivoComprimido);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
          {
            method: "POST",
            body: formData,
          },
        );

        const data = await res.json();
        if (data.secure_url) {
          urlComprovanteSalva = data.secure_url;
        } else {
          throw new Error("Falha ao enviar o arquivo para a nuvem.");
        }
      }

      // Prepara o texto da justificativa baseado na seleção
      let textoJustificativa = justificativaAusencia.trim();
      if (tipoAusencia === "atestado") textoJustificativa = "Atestado Médico";
      if (tipoAusencia === "ferias") textoJustificativa = "Férias";

      const promessas = datasParaSalvar.map((dataAlvo) => {
        const dadosRegistro: Record<string, unknown> = {
          agenteId: agenteSelecionado,
          registradoPorSupervisor: true,
          supervisorId: usuario.uid,
          dataRegistro: Timestamp.fromDate(dataAlvo),
          enviadoEm: serverTimestamp(),
          houveDesembarque: false,
          observacoes: justificarAusencia
            ? `Registro de ausência justificada pelo supervisor: ${textoJustificativa}`
            : "Registro enviado pelo supervisor.",
          ausenciaJustificada: justificarAusencia,
          justificativaAusencia: justificarAusencia ? textoJustificativa : null,
          urlComprovante: urlComprovanteSalva,
          solicitacaoRelatorio: false,
          identificacaoRelatorio: null,
        };

        return addDoc(collection(db, "registros_diarios"), dadosRegistro);
      });

      await Promise.all(promessas);
      router.push("/supervisor");
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar o(s) registro(s). Verifique sua conexão.");
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
            className="w-full border border-slate-200 rounded-md bg-slate-50 p-2.5 text-slate-800 focus:outline-none"
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

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm font-semibold text-slate-800">
            Justificar ausência?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="ausencia"
                checked={justificarAusencia}
                onChange={() => setJustificarAusencia(true)}
              />
              Sim
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="ausencia"
                checked={!justificarAusencia}
                onChange={() => {
                  setJustificarAusencia(false);
                  setTipoAusencia("");
                  setJustificativaAusencia("");
                  setArquivoAtestado(null);
                  setDataFim("");
                }}
              />
              Não
            </label>
          </div>

          {justificarAusencia && (
            <div className="space-y-4 pt-4 border-t border-slate-200 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  Tipo de Justificativa
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md bg-white p-2.5 text-slate-800 focus:outline-none"
                  value={tipoAusencia}
                  onChange={(e) => {
                    setTipoAusencia(
                      e.target.value as "atestado" | "ferias" | "outro",
                    );
                    if (e.target.value !== "outro") {
                      setJustificativaAusencia("");
                    }
                  }}
                  required
                >
                  <option value="">Selecione o tipo...</option>
                  <option value="atestado">Atestado Médico</option>
                  <option value="ferias">Férias</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              {tipoAusencia === "outro" && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-semibold text-slate-800">
                    Descrição do Motivo (Obrigatório)
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-md p-2.5 text-sm text-slate-800 focus:outline-none bg-white"
                    placeholder="Explique o motivo da ausência..."
                    value={justificativaAusencia}
                    onChange={(e) => setJustificativaAusencia(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              )}

              {(tipoAusencia === "atestado" || tipoAusencia === "outro") && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-semibold text-slate-800 block">
                    Anexar Comprovante / Atestado (Obrigatório)
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setArquivoAtestado(e.target.files[0]);
                      }
                    }}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer bg-white border border-slate-200 rounded-md p-1"
                  />
                  {arquivoAtestado && (
                    <p className="text-xs font-medium text-emerald-600 mt-1">
                      Anexo selecionado: {arquivoAtestado.name}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">
              {justificarAusencia ? "Data Inicial" : "Data do registro"}
            </label>
            <input
              type="date"
              value={dataRegistro}
              onChange={(e) => setDataRegistro(e.target.value)}
              className="w-full border border-slate-200 rounded-md bg-slate-50 p-2.5 text-slate-800 focus:outline-none"
              required
            />
          </div>

          {justificarAusencia && (
            <div className="space-y-2 animate-in fade-in">
              <label className="text-sm font-semibold text-slate-800">
                Data Final (Obrigatório)
              </label>
              <input
                type="date"
                value={dataFim}
                min={dataRegistro}
                required
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full border border-slate-200 rounded-md bg-slate-50 p-2.5 text-slate-800 focus:outline-none"
              />
            </div>
          )}
        </div>

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Processando Lançamento..." : "Registrar"}
        </Button>
      </form>
    </main>
  );
}
