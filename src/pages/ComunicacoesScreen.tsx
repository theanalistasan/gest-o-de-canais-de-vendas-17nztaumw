import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  Users,
  Settings2,
  CheckCircle2,
  Filter,
  Eye,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Mail,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  contatosService,
  revendasService,
  auxiliaresService,
  comunicacoesService,
} from '@/services/apiService'
import type {
  Contato,
  Revenda,
  Segmento,
  Estado,
  InsideSales,
  Responsavel,
  CanalFaturamento,
  Cargo,
  StatusRevenda,
  Remetente,
  EmailTemplate,
} from '@/types'

export const ComunicacoesScreen: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Passo atual: 1 (Destinatários), 2 (Configuração), 3 (Revisão)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Dados carregados
  const [contatos, setContatos] = useState<Contato[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [insideSales, setInsideSales] = useState<InsideSales[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [canais, setCanais] = useState<CanalFaturamento[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [statusRevenda, setStatusRevenda] = useState<StatusRevenda[]>([])
  const [remetentes, setRemetentes] = useState<Remetente[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // PASSO 1: FILTROS DE SELEÇÃO DE DESTINATÁRIOS
  const [filterSegmento, setFilterSegmento] = useState('all')
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterRevendaIds, setFilterRevendaIds] = useState<string[]>([])
  const [filterCanal, setFilterCanal] = useState('all')
  const [filterInside, setFilterInside] = useState('all')
  const [filterResponsavel, setFilterResponsavel] = useState('all')
  const [filterCargo, setFilterCargo] = useState('all')
  const [filterStatusRevenda, setFilterStatusRevenda] = useState('all')
  const [filterContatoPrincipal, setFilterContatoPrincipal] = useState('all')
  const [filterRecebeComunicacoes, setFilterRecebeComunicacoes] = useState('sim') // Default: apenas quem recebe

  // Modal de Pré-visualização de destinatários
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // PASSO 2: CONFIGURAÇÃO DO ENVIO
  const [nomeCampanha, setNomeCampanha] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [selectedRemetente, setSelectedRemetente] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [tipoEnvio, setTipoEnvio] = useState<'Teste' | 'Producao'>('Producao')
  const [testeQtd, setTesteQtd] = useState<number>(1)
  const [customTesteQtd, setCustomTesteQtd] = useState<string>('5')
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(10)

  // Diagnóstico do Provedor de E-mail
  const [emailConfig, setEmailConfig] = useState<{
    mode: 'real' | 'simulado'
    configured: boolean
    message: string
  } | null>(null)

  // PASSO 3: CONFIRMAÇÃO E ENVIO
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true)
      try {
        const [cList, rList, segs, ests, ins, resps, cans, cgs, stats, rems, tmps] =
          await Promise.all([
            contatosService.getAll(),
            revendasService.getAll(),
            auxiliaresService.getSegmentos(),
            auxiliaresService.getEstados(),
            auxiliaresService.getInsideSales(),
            auxiliaresService.getResponsaveis(),
            auxiliaresService.getCanaisFaturamento(),
            auxiliaresService.getCargos(),
            auxiliaresService.getStatusRevenda(),
            auxiliaresService.getRemetentes(),
            auxiliaresService.getEmailTemplates(),
          ])

        setContatos(cList)
        setRevendas(rList)
        setSegmentos(segs)
        setEstados(ests)
        setInsideSales(ins)
        setResponsaveis(resps)
        setCanais(cans)
        setCargos(cgs)
        setStatusRevenda(stats)
        setRemetentes(rems)
        setTemplates(tmps)

        try {
          const cfg = await adminService.getEmailConfig()
          setEmailConfig(cfg)
        } catch {
          /* intentionally ignored */
        }

        if (rems.length > 0) {
          setSelectedRemetente(rems[0].email)
        } else {
          setSelectedRemetente('comunicados@rolanddg.com.br')
        }
      } catch (err) {
        console.error('Erro ao carregar dados de comunicações:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadAll()
  }, [])

  // Mapa de revendas por ID para filtro ágil
  const revendasMap = useMemo(() => {
    const map = new Map<string, Revenda>()
    for (const r of revendas) map.set(r.id, r)
    return map
  }, [revendas])

  // Destinatários filtrados elegíveis
  const destinatariosFiltrados = useMemo(() => {
    return contatos.filter((c) => {
      const revenda = revendasMap.get(c.revenda)
      if (!revenda) return false

      // Filtro de revenda multi-select
      if (filterRevendaIds.length > 0 && !filterRevendaIds.includes(c.revenda)) {
        return false
      }
      // Filtro de segmento
      if (filterSegmento !== 'all' && revenda.segmento !== filterSegmento) return false
      // Filtro de estado
      if (filterEstado !== 'all' && revenda.estado !== filterEstado) return false
      // Filtro de canal
      if (filterCanal !== 'all' && revenda.canal_faturamento !== filterCanal) return false
      // Filtro de inside sales
      if (filterInside !== 'all' && revenda.inside_sales !== filterInside) return false
      // Filtro de responsável
      if (filterResponsavel !== 'all' && revenda.responsavel !== filterResponsavel) return false
      // Filtro de status da revenda
      if (filterStatusRevenda !== 'all' && revenda.status !== filterStatusRevenda) return false
      // Filtro de cargo
      if (filterCargo !== 'all' && c.cargo !== filterCargo) return false
      // Filtro de contato principal
      if (filterContatoPrincipal === 'sim' && !c.contato_principal) return false
      if (filterContatoPrincipal === 'nao' && c.contato_principal) return false
      // Filtro de recebe comunicações
      if (filterRecebeComunicacoes === 'sim' && c.recebe_comunicacoes === false) return false
      if (filterRecebeComunicacoes === 'nao' && c.recebe_comunicacoes !== false) return false
      // Contato ativo
      if (c.status_contato === 'Inativo') return false

      return true
    })
  }, [
    contatos,
    revendasMap,
    filterRevendaIds,
    filterSegmento,
    filterEstado,
    filterCanal,
    filterInside,
    filterResponsavel,
    filterStatusRevenda,
    filterCargo,
    filterContatoPrincipal,
    filterRecebeComunicacoes,
  ])

  // Lista final a receber a comunicação dependendo do Modo (Teste vs Produção)
  const destinatariosFinais = useMemo(() => {
    if (tipoEnvio === 'Teste') {
      const limit = testeQtd === -1 ? Math.max(1, parseInt(customTesteQtd, 10) || 1) : testeQtd
      return destinatariosFiltrados.slice(0, limit)
    }
    return destinatariosFiltrados
  }, [destinatariosFiltrados, tipoEnvio, testeQtd, customTesteQtd])

  // Inserir placeholder no cursor do textarea
  const insertPlaceholder = (tag: string) => {
    const el = textareaRef.current
    if (!el) {
      setCorpo((prev) => prev + tag)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = el.value
    const newText = text.substring(0, start) + tag + text.substring(end)
    setCorpo(newText)
    setTimeout(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + tag.length
    }, 0)
  }

  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const tmpl = templates.find((t) => t.id === templateId)
    if (tmpl) {
      setAssunto(tmpl.assunto)
      setCorpo(tmpl.corpo)
    }
  }

  // Salvar como Rascunho
  const handleSaveDraft = async () => {
    if (!user) return
    setIsSubmitting(true)
    try {
      await comunicacoesService.createCampanha({
        nome: nomeCampanha.trim() || `Rascunho ${new Date().toLocaleDateString('pt-BR')}`,
        assunto: assunto.trim() || 'Sem assunto',
        corpo: corpo.trim(),
        remetente: selectedRemetente,
        tipo_envio: tipoEnvio,
        intervalo_segundos: intervaloSegundos,
        quantidade_destinatarios: destinatariosFinais.length,
        status: 'Rascunho',
        usuario: user.id,
      })
      alert('Campanha salva como Rascunho com sucesso!')
      navigate('/historico')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar rascunho.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirmar e Iniciar Envio
  const handleConfirmAndSend = async () => {
    if (!user) return
    if (destinatariosFinais.length === 0) {
      alert('Nenhum destinatário válido selecionado.')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Criar a Campanha com status "Enviando"
      const camp = await comunicacoesService.createCampanha({
        nome: nomeCampanha.trim() || `Disparo ${assunto.substring(0, 30)}`,
        assunto: assunto.trim(),
        corpo: corpo.trim(),
        remetente: selectedRemetente,
        tipo_envio: tipoEnvio,
        intervalo_segundos: intervaloSegundos,
        quantidade_destinatarios: destinatariosFinais.length,
        status: 'Enviando',
        usuario: user.id,
      })

      // 2. Criar os registros individuais na fila `envios` com status "Pendente"
      // Cada contato recebe uma mensagem individual exclusiva
      for (const dest of destinatariosFinais) {
        await comunicacoesService.createEnvio({
          campanha: camp.id,
          contato: dest.id,
          revenda: dest.revenda,
          email_utilizado: dest.email || dest.email_secundario || '',
          status: 'Pendente',
          sucesso: false,
          erro: false,
          mensagem_erro: '',
        })
      }

      // 3. Chamar o endpoint customizado do backend para iniciar processamento imediato
      await comunicacoesService.triggerProcessarEnvios(camp.id)

      setIsConfirmModalOpen(false)
      navigate('/historico')
    } catch (err) {
      console.error('Falha ao enfileirar disparo:', err)
      alert('Ocorreu um erro ao enfileirar a comunicação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* CABEÇALHO & PROGRESSO DOS PASSOS */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Comunicações Segmentadas por E-mail
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-slate-500">
            Envios controlados, individuais e auditáveis para a rede autorizada
          </p>
          {emailConfig && (
            <div>
              {emailConfig.configured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Envio Real (SMTP Ativo)
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                  title="Nenhum e-mail de fato é entregue para caixas postais reais enquanto o SMTP não for configurado"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Simulado — nenhum e-mail enviado de fato
                </span>
              )}
            </div>
          )}
        </div>

        {/* STEPPER */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {/* Passo 1 */}
          <button
            onClick={() => setStep(1)}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
              step === 1
                ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-900">Destinatários</span>
              <span className="text-[11px] text-slate-400">Seleção e filtros</span>
            </div>
          </button>

          {/* Passo 2 */}
          <button
            onClick={() => setStep(2)}
            disabled={destinatariosFiltrados.length === 0}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left disabled:opacity-40 ${
              step === 2
                ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-900">Configuração</span>
              <span className="text-[11px] text-slate-400">Mensagem e parâmetros</span>
            </div>
          </button>

          {/* Passo 3 */}
          <button
            onClick={() => {
              if (!assunto.trim() || !corpo.trim()) {
                alert('Preencha o assunto e o corpo da mensagem no Passo 2 antes de avançar.')
                return
              }
              setStep(3)
            }}
            disabled={!assunto.trim() || !corpo.trim()}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left disabled:opacity-40 ${
              step === 3
                ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              3
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-900">Revisão</span>
              <span className="text-[11px] text-slate-400">Auditoria e confirmação</span>
            </div>
          </button>
        </div>
      </div>

      {/* ==================== PASSO 1: DESTINATÁRIOS ==================== */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in">
          {/* CARD DE FILTROS COMBINÁVEIS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Filter className="h-4 w-4 text-blue-600" />
                <span>Segmentação do Público-Alvo</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterSegmento('all')
                  setFilterEstado('all')
                  setFilterRevendaIds([])
                  setFilterCanal('all')
                  setFilterInside('all')
                  setFilterResponsavel('all')
                  setFilterCargo('all')
                  setFilterStatusRevenda('all')
                  setFilterContatoPrincipal('all')
                  setFilterRecebeComunicacoes('sim')
                }}
                className="text-xs text-slate-500 hover:text-blue-600"
              >
                Resetar Filtros
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {/* Segmento */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Segmento
                </label>
                <select
                  value={filterSegmento}
                  onChange={(e) => setFilterSegmento(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os segmentos</option>
                  {segmentos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Estado
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os estados</option>
                  {estados.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.uf} - {est.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Canal Faturamento */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Canal Faturamento
                </label>
                <select
                  value={filterCanal}
                  onChange={(e) => setFilterCanal(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os canais</option>
                  {canais.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inside Sales */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Inside Sales
                </label>
                <select
                  value={filterInside}
                  onChange={(e) => setFilterInside(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os Inside</option>
                  {insideSales.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsável Comercial */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Responsável
                </label>
                <select
                  value={filterResponsavel}
                  onChange={(e) => setFilterResponsavel(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os responsáveis</option>
                  {responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Cargo do Contato
                </label>
                <select
                  value={filterCargo}
                  onChange={(e) => setFilterCargo(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os cargos</option>
                  {cargos.map((cg) => (
                    <option key={cg.id} value={cg.id}>
                      {cg.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Revenda */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Status da Revenda
                </label>
                <select
                  value={filterStatusRevenda}
                  onChange={(e) => setFilterStatusRevenda(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos os status</option>
                  {statusRevenda.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contato Principal */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Contato Principal?
                </label>
                <select
                  value={filterContatoPrincipal}
                  onChange={(e) => setFilterContatoPrincipal(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="sim">Apenas Contatos Principais</option>
                  <option value="nao">Apenas Secundários</option>
                </select>
              </div>
            </div>

            {/* Revendas Multi-select simples */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                Revendas Específicas{' '}
                <span className="text-slate-400 font-normal">
                  (Opcional: selecione uma ou mais)
                </span>
              </label>
              <div className="max-h-28 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 text-xs">
                {revendas.map((r) => {
                  const isChecked = filterRevendaIds.includes(r.id)
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-1.5 text-slate-700 truncate cursor-pointer hover:text-blue-600 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterRevendaIds([...filterRevendaIds, r.id])
                          } else {
                            setFilterRevendaIds(filterRevendaIds.filter((id) => id !== r.id))
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span
                        className="truncate"
                        title={r.codigo ? `[${r.codigo}] ${r.nome}` : r.nome}
                      >
                        {r.codigo ? (
                          <span className="font-mono text-[10px] font-bold text-blue-700 mr-1">
                            [{r.codigo}]
                          </span>
                        ) : null}
                        {r.nome}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* CONTADOR GRANDE DE DESTINATÁRIOS */}
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-cyan-300">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-cyan-300">
                  Audiência Estimada
                </span>
                <div className="text-3xl font-extrabold tracking-tight">
                  {destinatariosFiltrados.length} destinatários selecionados
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Cada pessoa receberá uma mensagem individual e personalizada
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                disabled={destinatariosFiltrados.length === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <Eye className="h-4 w-4" />
                <span>Pré-visualizar Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={destinatariosFiltrados.length === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <span>Avançar para Configuração</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PASSO 2: CONFIGURAÇÃO ==================== */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Settings2 className="h-4 w-4 text-blue-600" />
              <span>Configuração da Mensagem e Modo de Disparo</span>
            </div>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Voltar aos Destinatários</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nome da Campanha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Identificação Interna da Campanha *
              </label>
              <input
                type="text"
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
                placeholder="Ex: Comunicado Roland Linha 2026"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Template Salvo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modelo / Template Salvo
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleApplyTemplate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Nenhum (Digitar do zero)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Remetente */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Remetente Permitido *
              </label>
              <select
                value={selectedRemetente}
                onChange={(e) => setSelectedRemetente(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
              >
                {remetentes.length === 0 && (
                  <option value="comunicados@rolanddg.com.br">comunicados@rolanddg.com.br</option>
                )}
                {remetentes.map((r) => (
                  <option key={r.id} value={r.email}>
                    {r.nome} &lt;{r.email}&gt;
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assunto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assunto do E-mail *
            </label>
            <input
              type="text"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Assunto que o destinatário verá na caixa de entrada..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Corpo com Placeholders */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Corpo da Mensagem *
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Inserir campos:</span>
                <button
                  type="button"
                  onClick={() => insertPlaceholder('{{nome}}')}
                  className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-medium hover:bg-blue-100"
                >
                  &#123;&#123;nome&#125;&#125;
                </button>
                <button
                  type="button"
                  onClick={() => insertPlaceholder('{{revenda}}')}
                  className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-medium hover:bg-blue-100"
                >
                  &#123;&#123;revenda&#125;&#125;
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              rows={8}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Olá {{nome}},&#10;&#10;Escrevemos para a {{revenda}} com novidades importantes..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
            />
          </div>

          {/* MODO DE ENVIO & INTERVALO */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Modo de Envio (Teste vs Produção) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">Modo de Envio</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEnvio"
                      checked={tipoEnvio === 'Producao'}
                      onChange={() => setTipoEnvio('Producao')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        Modo Produção
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Dispara para todos os {destinatariosFiltrados.length} destinatários
                        selecionados.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                    <input
                      type="radio"
                      name="tipoEnvio"
                      checked={tipoEnvio === 'Teste'}
                      onChange={() => setTipoEnvio('Teste')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">Modo Teste</span>
                      <span className="text-[11px] text-slate-500">
                        Dispara apenas para uma amostra controlada da lista.
                      </span>

                      {tipoEnvio === 'Teste' && (
                        <div className="flex items-center gap-3 mt-2 pl-1">
                          {[1, 5, 10].map((qtd) => (
                            <label
                              key={qtd}
                              className="flex items-center gap-1 text-xs text-slate-700"
                            >
                              <input
                                type="radio"
                                name="testeQtd"
                                checked={testeQtd === qtd}
                                onChange={() => setTesteQtd(qtd)}
                                className="text-blue-600"
                              />
                              <span>
                                {qtd} {qtd === 1 ? 'contato' : 'contatos'}
                              </span>
                            </label>
                          ))}
                          <label className="flex items-center gap-1 text-xs text-slate-700">
                            <input
                              type="radio"
                              name="testeQtd"
                              checked={testeQtd === -1}
                              onChange={() => setTesteQtd(-1)}
                              className="text-blue-600"
                            />
                            <span>Outra qtd:</span>
                            <input
                              type="number"
                              min={1}
                              max={destinatariosFiltrados.length}
                              value={customTesteQtd}
                              onChange={(e) => setCustomTesteQtd(e.target.value)}
                              className="w-16 px-1.5 py-0.5 text-xs border rounded bg-white"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Intervalo entre envios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    <span>Intervalo entre Mensagens</span>
                  </label>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {intervaloSegundos}s por envio
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Garante cadência controlada e conformidade com as políticas do servidor
                  corporativo. Mínimo 1s.
                </p>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={intervaloSegundos}
                    onChange={(e) => setIntervaloSegundos(Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={intervaloSegundos}
                    onChange={(e) => setIntervaloSegundos(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg text-center font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              Salvar como Rascunho
            </button>

            <button
              type="button"
              onClick={() => {
                if (!assunto.trim() || !corpo.trim()) {
                  alert('Por favor, preencha o assunto e o corpo da mensagem.')
                  return
                }
                setStep(3)
              }}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <span>Avançar para Revisão</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================== PASSO 3: REVISÃO ==================== */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in">
          {/* AVISO IMPORTANTE DE ENVIO INDIVIDUAL */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-xs text-blue-900 leading-relaxed">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-semibold mb-0.5">
                Envio Individual e Controlado
              </strong>
              Este disparo não cria uma mensagem com destinatários em cópia oculta ou aberta. Cada
              destinatário receberá uma mensagem individual personalizada, com os placeholders{' '}
              <code className="font-mono text-blue-700">&#123;&#123;nome&#125;&#125;</code> e{' '}
              <code className="font-mono text-blue-700">&#123;&#123;revenda&#125;&#125;</code>{' '}
              substituídos por seus dados cadastrais.
            </div>
          </div>

          {/* PAINEL RESUMO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-100 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Tipo de Envio
                </span>
                <span className="font-bold text-slate-800 text-sm">{tipoEnvio}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Qtd. de Mensagens
                </span>
                <span className="font-bold text-blue-600 text-sm">
                  {destinatariosFinais.length} envios individuais
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Remetente
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedRemetente}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Cadência
                </span>
                <span className="font-semibold text-slate-800">
                  {intervaloSegundos} segundos / mensagem
                </span>
              </div>
            </div>

            {/* Pré-visualização da mensagem */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pré-visualização da Mensagem
              </h3>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-700">Assunto: </span>
                  <span className="text-slate-900 font-semibold">{assunto}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans bg-white p-3 rounded-lg border">
                  {corpo
                    .replace(/{{nome}}/g, destinatariosFinais[0]?.nome || '[Nome do Contato]')
                    .replace(
                      /{{revenda}}/g,
                      destinatariosFinais[0]?.expand?.revenda?.nome || '[Nome da Revenda]',
                    )}
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  * Exemplo simulado com o primeiro destinatário da lista (
                  {destinatariosFinais[0]?.nome || 'Contato'}).
                </p>
              </div>
            </div>

            {/* Mini tabela com os destinatários */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Destinatários Incluídos ({destinatariosFinais.length})
              </h3>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">Cód. Revenda</th>
                      <th className="py-2 px-3">Revenda</th>
                      <th className="py-2 px-3">E-mail Utilizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {destinatariosFinais.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3 font-semibold">{d.nome}</td>
                        <td className="py-2 px-3 font-mono text-[11px] font-semibold text-blue-700">
                          {revendasMap.get(d.revenda)?.codigo || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {revendasMap.get(d.revenda)?.nome || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-blue-700">
                          {d.email || d.email_secundario || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOTÕES DE CONFIRMAÇÃO */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Editar Mensagem
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                >
                  Salvar Rascunho
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Confirmar e Iniciar Disparo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE DESTINATÁRIOS (PASSO 1) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Lista de Destinatários ({destinatariosFiltrados.length})
              </h3>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3">Cód. Revenda</th>
                    <th className="py-2.5 px-3">Revenda</th>
                    <th className="py-2.5 px-3">E-mail Principal</th>
                    <th className="py-2.5 px-3">Telefone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {destinatariosFiltrados.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">{d.nome}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-blue-700">
                        {revendasMap.get(d.revenda)?.codigo || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {revendasMap.get(d.revenda)?.nome || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-700">
                        {d.email || d.email_secundario || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {d.telefone || d.celular || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPLÍCITO DE CONFIRMAÇÃO DE ENVIO */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 scale-in">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Send className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Iniciar Enfileiramento?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Você está prestes a enfileirar{' '}
                <strong className="text-slate-800">
                  {destinatariosFinais.length} e-mails individuais
                </strong>{' '}
                no modo <strong className="text-blue-600">{tipoEnvio}</strong> com intervalo de{' '}
                <strong className="text-slate-800">{intervaloSegundos}s</strong> entre cada um.
              </p>
              {!emailConfig?.configured && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-left text-[11px] text-amber-800">
                  <span className="font-bold block mb-0.5">⚠️ Ambiente em Modo Simulado:</span>
                  Nenhum e-mail sairá para a internet. O envio será registrado no banco e no
                  Histórico com a etiqueta "Simulado — nenhum e-mail enviado de fato". Para envio
                  real, configure as credenciais SMTP no ambiente.
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSend}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enfileirando...</span>
                  </>
                ) : (
                  <span>Sim, Confirmar Disparo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
