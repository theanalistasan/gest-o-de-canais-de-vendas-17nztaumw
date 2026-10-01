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
  Paperclip,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  contatosService,
  revendasService,
  auxiliaresService,
  comunicacoesService,
  adminService,
} from '@/services/apiService'
import {
  executeWithRetry,
  DEFAULT_EMAIL_FECHAMENTO,
  ROLAND_LOGO_URL,
  DIREITOS_RESERVADOS_TEXT,
  CONFIDENCIALIDADE_BLOCO_UNIFICADO,
} from '@/lib/emailTemplateHelper'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
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
  Campanha,
} from '@/types'

export const ComunicacoesScreen: React.FC = () => {
  const { user, canWrite } = useAuth()
  const { toast } = useToast()
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
  const [fechamento, setFechamento] = useState(() => {
    const saved = localStorage.getItem('roland_email_fechamento')
    if (saved && saved.toLowerCase().includes('olá teste')) {
      try {
        localStorage.setItem('roland_email_fechamento', DEFAULT_EMAIL_FECHAMENTO)
      } catch {
        /* intentionally ignored */
      }
      return DEFAULT_EMAIL_FECHAMENTO
    }
    return saved || DEFAULT_EMAIL_FECHAMENTO
  })
  const [selectedRemetente, setSelectedRemetente] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [tipoEnvio, setTipoEnvio] = useState<'Teste' | 'Producao'>('Producao')
  const [testeQtd, setTesteQtd] = useState<number>(1)
  const [customTesteQtd, setCustomTesteQtd] = useState<string>('5')
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(10)
  const [anexos, setAnexos] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Status e progresso de enfileiramento / retries
  const [enfileiramentoProgresso, setEnfileiramentoProgresso] = useState<{
    total: number
    atual: number
  } | null>(null)
  const [retryStatusMessage, setRetryStatusMessage] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Atualizar localStorage quando o fechamento for modificado
  const handleFechamentoChange = (novoFechamento: string) => {
    setFechamento(novoFechamento)
    try {
      localStorage.setItem('roland_email_fechamento', novoFechamento)
    } catch {
      /* intentionally ignored */
    }
  }

  // Diagnóstico do Provedor de E-mail
  const [emailConfig, setEmailConfig] = useState<{
    mode: 'real' | 'simulado'
    configured: boolean
    message: string
  } | null>(null)

  // PASSO 3: CONFIRMAÇÃO E ENVIO
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [duplicateCampanhaWarning, setDuplicateCampanhaWarning] = useState<Campanha | null>(null)
  const isEnfileirandoRef = useRef(false)

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

  // Controle do modal de Salvar Modelo
  const [isSaveModelModalOpen, setIsSaveModelModalOpen] = useState(false)
  const [saveModelNome, setSaveModelNome] = useState('')
  const [saveModelConflict, setSaveModelConflict] = useState<EmailTemplate | null>(null)
  const [isSavingModel, setIsSavingModel] = useState(false)

  // Controle do modal de Excluir Modelo
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null)
  const [isDeletingModel, setIsDeletingModel] = useState(false)

  // Abertura do modal para Salvar Modelo / Template
  const handleOpenSaveTemplateModal = () => {
    if (!user || !canWrite) {
      toast({
        title: 'Acesso negado',
        description: 'Usuários com perfil Consulta não possuem permissão para salvar modelos.',
        variant: 'destructive',
      })
      return
    }
    const templateCorpo = corpo.trim()
    if (!templateCorpo) {
      toast({
        title: 'Corpo vazio',
        description: 'Digite o conteúdo da mensagem antes de salvar como Modelo / Template.',
        variant: 'destructive',
      })
      return
    }

    // Sugere nome baseado no assunto ou no nome do modelo atualmente carregado
    const currentTmpl = selectedTemplateId
      ? templates.find((t) => t.id === selectedTemplateId)
      : null
    const initialNome = currentTmpl?.nome || assunto.trim() || nomeCampanha.trim() || ''
    setSaveModelNome(initialNome)
    setSaveModelConflict(null)
    setIsSaveModelModalOpen(true)
  }

  // Efetivar a gravação do modelo com validação de nome e tratamento de sobrescrita
  const handleConfirmSaveTemplate = async (forceOverwrite = false) => {
    const nomeLimpo = saveModelNome.trim()
    if (!nomeLimpo) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe um nome para o modelo antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    // Verificar se existe conflito de nome
    const conflict = templates.find((t) => t.nome.toLowerCase() === nomeLimpo.toLowerCase())
    if (conflict && !forceOverwrite) {
      // Se estamos editando o próprio modelo já carregado com o mesmo nome, atualiza sem conflito
      if (selectedTemplateId && conflict.id === selectedTemplateId) {
        // pode seguir diretamente
      } else {
        setSaveModelConflict(conflict)
        return
      }
    }

    setIsSavingModel(true)
    try {
      const templateData = {
        nome: nomeLimpo,
        assunto: assunto.trim() || 'Sem assunto',
        corpo: corpo.trim(),
      }

      let savedTmpl: EmailTemplate
      const targetId = conflict ? conflict.id : selectedTemplateId

      if (targetId) {
        savedTmpl = await executeWithRetry(
          () => auxiliaresService.updateEmailTemplate(targetId, templateData),
          {
            onRetry: (_attempt, _err, delay) => {
              setRetryStatusMessage(
                `O servidor está processando muitas requisições simultâneas. Aguardando liberação (${Math.round(delay)}ms)…`,
              )
            },
          },
        )
      } else {
        savedTmpl = await executeWithRetry(
          () => auxiliaresService.createEmailTemplate(templateData),
          {
            onRetry: (_attempt, _err, delay) => {
              setRetryStatusMessage(
                `O servidor está processando muitas requisições simultâneas. Aguardando liberação (${Math.round(delay)}ms)…`,
              )
            },
          },
        )
      }

      // Atualizar lista sem recarregar a página
      const updatedList = await auxiliaresService.getEmailTemplates()
      setTemplates(updatedList)
      setSelectedTemplateId(savedTmpl.id)
      setIsSaveModelModalOpen(false)
      setSaveModelConflict(null)

      toast({
        title: 'Modelo salvo com sucesso!',
        description: `O modelo "${savedTmpl.nome}" foi salvo e já está disponível para futuras comunicações.`,
        className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      })
    } catch (err: unknown) {
      console.error('Erro ao salvar modelo:', err)
      toast({
        title: 'Erro ao salvar modelo',
        description: 'O servidor não pôde concluir a gravação. Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingModel(false)
      setRetryStatusMessage(null)
    }
  }

  // Excluir modelo salvo
  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete || !canWrite) {
      toast({
        title: 'Acesso negado',
        description: 'Usuários com perfil Consulta não possuem permissão para excluir modelos.',
        variant: 'destructive',
      })
      setTemplateToDelete(null)
      return
    }

    const idExcluir = templateToDelete.id
    const nomeExcluir = templateToDelete.nome
    setIsDeletingModel(true)

    try {
      await executeWithRetry(() => auxiliaresService.deleteEmailTemplate(idExcluir))

      // Atualiza lista em memória e no backend sem recarregar a página
      setTemplates((prev) => prev.filter((t) => t.id !== idExcluir))

      // Se o modelo excluído era o que estava selecionado no select, limpa a referência mantendo o conteúdo
      if (selectedTemplateId === idExcluir) {
        setSelectedTemplateId('')
      }

      toast({
        title: 'Modelo excluído',
        description: `O modelo "${nomeExcluir}" foi removido com sucesso. O conteúdo no editor foi preservado.`,
        className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      })
      setTemplateToDelete(null)
    } catch (err: unknown) {
      console.error('Erro ao excluir modelo:', err)
      toast({
        title: 'Erro ao excluir modelo',
        description:
          'Não foi possível excluir o modelo. Verifique suas permissões e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDeletingModel(false)
    }
  }

  // Aborta o enfileiramento restante se o usuário cancelar
  const handleAbortEnfileiramento = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    isEnfileirandoRef.current = false
    setIsSubmitting(false)
    setIsConfirmModalOpen(false)
    setRetryStatusMessage(null)
  }

  // Abertura do fluxo de confirmação e disparo com verificação prévia de duplicados
  const handleOpenConfirmModal = async () => {
    if (!user || !canWrite) {
      toast({
        title: 'Acesso negado',
        description:
          'Usuários com perfil Consulta não possuem permissão para disparar comunicações.',
        variant: 'destructive',
      })
      return
    }

    if (destinatariosFinais.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione ao menos um destinatário válido antes de disparar.',
        variant: 'destructive',
      })
      return
    }

    const assuntoValido = assunto.trim()
    const corpoValido = corpo.trim()

    if (!assuntoValido || !corpoValido) {
      toast({
        title: 'Campos incompletos',
        description: 'Preencha o assunto e o corpo da mensagem antes de continuar.',
        variant: 'destructive',
      })
      return
    }

    // Trava de disparo duplicado:
    // Decisão: Modo Teste é isento da trava (disparo de teste para si mesmo pode repetir à vontade).
    // Modo Produção: verificar se já existe campanha concluída ou em andamento com o mesmo assunto e corpo nas últimas 24h.
    if (tipoEnvio !== 'Teste') {
      setIsCheckingDuplicate(true)
      try {
        const duplicada = await comunicacoesService.findRecentDuplicateCampanha(
          assuntoValido,
          corpoValido,
        )
        if (duplicada) {
          setDuplicateCampanhaWarning(duplicada)
          return
        }
      } catch (err) {
        console.warn('Erro ao verificar duplicados:', err)
      } finally {
        setIsCheckingDuplicate(false)
      }
    }

    setDuplicateCampanhaWarning(null)
    setIsConfirmModalOpen(true)
  }

  // Confirmar e Iniciar Envio
  const handleConfirmAndSend = async () => {
    // Guard estrito contra duplo clique ou requisições concorrentes
    if (isEnfileirandoRef.current || isSubmitting) {
      return
    }

    if (!user || !canWrite) {
      toast({
        title: 'Acesso negado',
        description:
          'Usuários com perfil Consulta não possuem permissão para disparar comunicações.',
        variant: 'destructive',
      })
      return
    }
    if (destinatariosFinais.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione ao menos um destinatário válido antes de disparar.',
        variant: 'destructive',
      })
      return
    }

    // Validações rigorosas de campos obrigatórios de Campanha antes da chamada à API
    const nomeValido = nomeCampanha.trim() || `Disparo ${assunto.trim().substring(0, 30)}`
    const assuntoValido = assunto.trim()
    const corpoValido = corpo.trim()
    const remetenteValido = selectedRemetente.trim()

    if (!assuntoValido) {
      toast({
        title: 'Assunto obrigatório',
        description: 'Por favor, informe o assunto da mensagem antes de iniciar o disparo.',
        variant: 'destructive',
      })
      return
    }

    if (!corpoValido) {
      toast({
        title: 'Conteúdo da mensagem vazio',
        description: 'Por favor, digite o conteúdo do e-mail no editor antes de disparar.',
        variant: 'destructive',
      })
      return
    }

    if (!remetenteValido) {
      toast({
        title: 'Remetente obrigatório',
        description: 'Selecione um remetente válido para a comunicação.',
        variant: 'destructive',
      })
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const signal = abortController.signal

    isEnfileirandoRef.current = true
    setIsSubmitting(true)
    setEnfileiramentoProgresso({ total: destinatariosFinais.length, atual: 0 })
    setRetryStatusMessage(null)

    let createdCampId: string | null = null
    let enfileiradosCount = 0

    try {
      // 1. Criar a Campanha com status "Enviando" usando executeWithRetry
      const formData = new FormData()
      formData.append('nome', nomeValido)
      formData.append('assunto', assuntoValido)
      formData.append('corpo', corpoValido)
      formData.append('remetente', remetenteValido)
      formData.append('tipo_envio', tipoEnvio)
      formData.append('intervalo_segundos', String(intervaloSegundos || 10))
      formData.append('quantidade_destinatarios', String(destinatariosFinais.length))
      formData.append('status', 'Enviando')
      formData.append('usuario', user.id)

      for (const file of anexos) {
        formData.append('anexos', file)
      }

      const camp = await executeWithRetry(() => comunicacoesService.createCampanha(formData), {
        signal,
        maxAttempts: 4,
        initialDelayMs: 500,
        onRetry: (_attempt, _err, delay, is429) => {
          if (is429) {
            setRetryStatusMessage(
              'O servidor está processando muitas requisições simultâneas. Aguardando liberação…',
            )
          } else {
            setRetryStatusMessage(`Aguardando estabilização do servidor (${Math.round(delay)}ms)…`)
          }
        },
      })

      createdCampId = camp.id

      // 2. Criar os registros individuais na fila `envios` com status "Pendente"
      // REGRA: Enfileiramento ESTRITAMENTE SEQUENCIAL (uma a uma, sem Promise.all)
      // Pausa base entre inserções de 450ms.
      // Em caso de 429: respeito ao Retry-After ou backoff adaptativo (1s -> 2s -> 4s -> 8s cap 30s)
      // Idempotência ativa: findExistingEnvio garante que nenhum retry ou re-execução crie duplicatas.
      const BASE_PAUSE_MS = 450

      for (let i = 0; i < destinatariosFinais.length; i++) {
        if (signal.aborted) {
          throw new DOMException('Operação cancelada pelo usuário', 'AbortError')
        }

        const dest = destinatariosFinais[i]
        const emailDest = dest.email || dest.email_secundario || ''

        await executeWithRetry(
          async () => {
            // Idempotência pré-inserção: checa se já existe envio para este contato/email nesta campanha
            const existing = await comunicacoesService.findExistingEnvio(
              camp.id,
              dest.id,
              emailDest,
            )

            if (existing) {
              return existing
            }

            return comunicacoesService.createEnvio({
              campanha: camp.id,
              contato: dest.id,
              revenda: dest.revenda,
              nome_contato: dest.nome || '',
              nome_revenda: revendasMap.get(dest.revenda)?.nome || '',
              codigo_revenda: revendasMap.get(dest.revenda)?.codigo || '',
              email_utilizado: emailDest,
              status: 'Pendente',
              sucesso: false,
              erro: false,
              mensagem_erro: '',
            })
          },
          {
            signal,
            maxAttempts: 5,
            initialDelayMs: 600,
            factor: 2,
            maxDelayMs: 30000,
            onRetry: (_att, _err, _delay, is429) => {
              if (is429) {
                setRetryStatusMessage(
                  'O servidor está processando muitas requisições simultâneas. Aguardando liberação…',
                )
              } else {
                setRetryStatusMessage(
                  'O servidor está processando muitas requisições simultâneas. Aguardando liberação…',
                )
              }
            },
          },
        )

        // Limpa a mensagem de retry se a requisição foi bem-sucedida
        setRetryStatusMessage(null)

        enfileiradosCount++
        setEnfileiramentoProgresso({
          total: destinatariosFinais.length,
          atual: enfileiradosCount,
        })

        // Pausa base obrigatória entre inserções sequenciais para respeitar o rate-limit do servidor
        if (i < destinatariosFinais.length - 1) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => resolve(), BASE_PAUSE_MS)
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                reject(new DOMException('Operação cancelada pelo usuário', 'AbortError'))
              },
              { once: true },
            )
          })
        }
      }

      // 3. Chamar o endpoint customizado do backend para iniciar processamento imediato
      if (!signal.aborted) {
        await comunicacoesService.triggerProcessarEnvios(camp.id)

        toast({
          title: 'Campanha enfileirada com sucesso!',
          description: `${destinatariosFinais.length} destinatários foram enfileirados e estão sendo processados.`,
          className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        })

        setIsConfirmModalOpen(false)
        navigate('/historico')
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn('Enfileiramento interrompido pelo usuário:', err)
        toast({
          title: 'Enfileiramento interrompido',
          description: `O processo foi cancelado. ${enfileiradosCount} de ${destinatariosFinais.length} destinatários foram registrados com segurança sem perda de dados.`,
          className: 'bg-amber-50 border-amber-200 text-amber-900',
        })
        if (createdCampId) {
          // Atualiza a quantidade real de destinatários enfileirados na campanha
          try {
            await comunicacoesService.updateCampanha(createdCampId, {
              quantidade_destinatarios: enfileiradosCount,
            })
            if (enfileiradosCount > 0) {
              await comunicacoesService.triggerProcessarEnvios(createdCampId)
            }
          } catch {
            /* intentionally ignored */
          }
        }
        return
      }

      console.error('Falha ao enfileirar disparo:', err)

      // Diagnóstico detalhado de erro em PT-BR para campos e erros do PocketBase
      const fieldErrors = extractFieldErrors(err)
      const fieldErrorKeys = Object.keys(fieldErrors)

      let friendlyDesc =
        'O servidor está processando muitas requisições simultâneas. O progresso gravado foi preservado de forma segura.'

      if (fieldErrorKeys.length > 0) {
        const nomesCamposPt: Record<string, string> = {
          nome: 'Nome da Campanha',
          assunto: 'Assunto',
          corpo: 'Conteúdo da mensagem',
          remetente: 'Remetente',
          tipo_envio: 'Tipo de Envio',
          intervalo_segundos: 'Intervalo de envio',
          quantidade_destinatarios: 'Quantidade de destinatários',
          status: 'Status',
          usuario: 'Usuário',
          anexos: 'Arquivos anexos',
        }
        const detalhes = fieldErrorKeys
          .map((k) => `${nomesCamposPt[k] || k}: ${fieldErrors[k]}`)
          .join(', ')
        friendlyDesc = `Dados inválidos no cadastro da campanha: ${detalhes}. Verifique e tente novamente.`
      }

      toast({
        title: 'Falha no enfileiramento',
        description: friendlyDesc,
        variant: 'destructive',
      })
    } finally {
      abortControllerRef.current = null
      isEnfileirandoRef.current = false
      setIsSubmitting(false)
      setEnfileiramentoProgresso(null)
      setRetryStatusMessage(null)
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

        {!canWrite && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-semibold mb-0.5">
                Modo Consulta (Somente Leitura)
              </strong>
              Seu perfil de usuário possui acesso exclusivo de consulta. O envio de comunicações,
              criação de disparos e salvamento de rascunhos estão estritamente bloqueados pela
              aplicação e pelo servidor.
            </div>
          </div>
        )}

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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Modelo / Template Salvo
                </label>
                {selectedTemplateId && (
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateId('')}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                    title="Desvincular modelo atual (conteúdo permanece intacto)"
                  >
                    Desvincular
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Nenhum (Digitar do zero)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>

                {/* Botão de exclusão do modelo selecionado (oculto para Consulta/Suporte) */}
                {canWrite && selectedTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      const tmpl = templates.find((t) => t.id === selectedTemplateId)
                      if (tmpl) setTemplateToDelete(tmpl)
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                    title="Excluir o modelo selecionado"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Lista rápida de modelos com opção de carregar e excluir (apenas se houver modelos) */}
              {templates.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-medium">Modelos salvos:</span>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-colors ${
                        selectedTemplateId === t.id
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(t.id)}
                        className="truncate max-w-[150px] text-left"
                        title={`Carregar "${t.nome}"`}
                      >
                        {t.nome}
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setTemplateToDelete(t)
                          }}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors ml-0.5"
                          title={`Excluir modelo "${t.nome}"`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

          {/* BLOCO FECHAMENTO / ASSINATURA FIXO-EDITÁVEL ROLAND DG */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Fechamento / Assinatura do E-mail (Fixo e Editável)
                </label>
                <p className="text-[11px] text-slate-500">
                  Este bloco oficial é anexado no final de todos os disparos corporativos. Suas
                  edições persistem localmente para as próximas mensagens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleFechamentoChange(DEFAULT_EMAIL_FECHAMENTO)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                title="Restaurar o texto padrão oficial da Roland DG"
              >
                Restaurar Padrão
              </button>
            </div>
            <textarea
              rows={4}
              value={fechamento}
              onChange={(e) => handleFechamentoChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono bg-white leading-relaxed text-slate-700"
            />
          </div>

          {/* PRÉ-VISUALIZAÇÃO EM TEMPO REAL DO E-MAIL COMPLETO (COM CABEÇALHO OFICIAL ROLAND DG) */}
          <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-blue-600" />
                <span>Visualização Oficial do E-mail (Como o cliente receberá)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Cabeçalho Roland DG Brasil + Corpo + Fechamento
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl mx-auto">
              {/* Header Roland DG */}
              <div className="py-4 px-6 sm:px-8 border-b-2 border-[#005696] flex items-center justify-between bg-white">
                <img
                  src={ROLAND_LOGO_URL}
                  alt="Roland DG Brasil"
                  className="w-[280px] sm:w-[340px] max-w-full h-auto object-contain"
                  onError={(e) => {
                    // Fallback visual caso bloqueador impeça carregamento do preview local
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
                <span className="text-xs font-bold text-[#005696] tracking-tight block sm:hidden">
                  Roland DG Brasil
                </span>
                <span className="text-[11px] font-medium text-slate-400">Comunicação Oficial</span>
              </div>
              {/* Corpo no Preview */}
              <div className="p-5 sm:p-6 text-xs text-slate-700 leading-relaxed space-y-4">
                <div className="font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  <span className="text-slate-400 font-normal">Assunto: </span>
                  {assunto || '(Sem assunto definido)'}
                </div>
                <div className="whitespace-pre-wrap font-sans min-h-[60px]">
                  {corpo
                    ? corpo
                        .replace(/{{nome}}/g, 'Carlos Silva')
                        .replace(/{{revenda}}/g, 'MegaPrint Soluções Gráficas')
                    : '(Digite o corpo da mensagem acima para visualizar aqui)'}
                </div>
                {/* Fechamento oficial no preview (duas primeiras linhas em negrito) */}
                <div className="pt-4 border-t border-slate-100 text-xs text-slate-600 font-sans leading-relaxed">
                  <div className="font-bold text-slate-800">Departamento Comercial</div>
                  <div className="font-bold text-slate-800 mt-2">
                    Roland DG Brasil Imp e Exp Ltda
                  </div>
                  <div>Rua San Jose, nº 780 - Pq Industrial San Jose</div>
                  <div>CEP 06715-862 - (11) 3500-2600 Opção 1</div>
                  {/* Se o fechamento foi customizado e difere do padrão, exibe abaixo */}
                  {fechamento.trim() !== DEFAULT_EMAIL_FECHAMENTO.trim() && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-[11px] text-slate-500 whitespace-pre-wrap">
                      {fechamento}
                    </div>
                  )}
                </div>

                {/* Linha Todos os direitos reservados + Aviso de Confidencialidade em Bloco Único (fonte menor 9.5-10px cinza) */}
                <div className="pt-4 border-t border-slate-100 font-sans">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    {DIREITOS_RESERVADOS_TEXT}
                  </div>
                  <div className="text-[9.5px] leading-relaxed text-slate-500 text-justify">
                    {CONFIDENCIALIDADE_BLOCO_UNIFICADO}
                  </div>
                </div>
              </div>
              {/* Rodapé Oficial no Preview */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-400">
                Roland DG Brasil • Todos os direitos reservados.
              </div>{' '}
            </div>
          </div>

          {/* UPLOAD DE ANEXOS */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <label className="text-xs font-bold text-slate-800">
                  Arquivos Anexos (Opcional)
                </label>
                <span className="text-[11px] text-slate-500">
                  (Até 5 arquivos, máx. 10MB cada: PDF, DOC/DOCX, XLS/XLSX, PNG, JPG)
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length === 0) return
                  const validMimes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'image/png',
                    'image/jpeg',
                  ]
                  const newAnexos = [...anexos]
                  for (const f of files) {
                    if (newAnexos.length >= 5) {
                      alert('Limite máximo de 5 anexos por campanha atingido.')
                      break
                    }
                    if (f.size > 10 * 1024 * 1024) {
                      alert(`O arquivo "${f.name}" excede o tamanho máximo de 10MB.`)
                      continue
                    }
                    if (
                      validMimes.length > 0 &&
                      !validMimes.includes(f.type) &&
                      !f.name.match(/\.(pdf|docx?|xlsx?|png|jpe?g)$/i)
                    ) {
                      alert(
                        `O formato do arquivo "${f.name}" não é permitido. Use PDF, DOC, DOCX, XLS, XLSX, PNG ou JPEG.`,
                      )
                      continue
                    }
                    newAnexos.push(f)
                  }
                  setAnexos(newAnexos)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={anexos.length >= 5}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>Adicionar Arquivo</span>
              </button>
            </div>

            {anexos.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {anexos.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[11px] text-slate-400 flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnexos(anexos.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Nenhum arquivo anexado a esta mensagem.
              </p>
            )}
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
            {canWrite ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenSaveTemplateModal}
                  disabled={isSubmitting || isSavingModel}
                  className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-1.5 disabled:opacity-50"
                  title="Salva na coleção de modelos reutilizáveis pedindo o nome"
                >
                  {isSavingModel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Salvar como Modelo / Template</span>
                </button>
              </div>
            ) : (
              <div />
            )}

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

            {/* Pré-visualização da mensagem completa com cabeçalho Roland DG */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pré-visualização da Mensagem Oficial Roland DG
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-700">Assunto: </span>
                  <span className="text-slate-900 font-semibold">{assunto}</span>
                </div>

                {/* Card imitando o e-mail real recebido */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Cabeçalho Roland DG */}
                  <div className="py-4 px-6 sm:px-8 border-b-2 border-[#005696] flex items-center justify-between bg-white">
                    <img
                      src={ROLAND_LOGO_URL}
                      alt="Roland DG Brasil"
                      className="w-[280px] sm:w-[340px] max-w-full h-auto object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                    <span className="text-[11px] font-semibold text-slate-400">
                      Comunicação Oficial
                    </span>
                  </div>
                  {/* Corpo com placeholders resolvidos para o 1º contato */}
                  <div className="p-5 text-xs text-slate-700 leading-relaxed font-sans space-y-4">
                    <div className="whitespace-pre-wrap">
                      {corpo
                        .replace(/{{nome}}/g, destinatariosFinais[0]?.nome || '[Nome do Contato]')
                        .replace(
                          /{{revenda}}/g,
                          destinatariosFinais[0]?.expand?.revenda?.nome ||
                            revendasMap.get(destinatariosFinais[0]?.revenda)?.nome ||
                            '[Nome da Revenda]',
                        )}
                    </div>

                    {/* Bloco de fechamento Roland DG (duas primeiras linhas em negrito) */}
                    <div className="pt-4 border-t border-slate-100 text-xs text-slate-600 font-sans leading-relaxed">
                      <div className="font-bold text-slate-800">Departamento Comercial</div>
                      <div className="font-bold text-slate-800 mt-2">
                        Roland DG Brasil Imp e Exp Ltda
                      </div>
                      <div>Rua San Jose, nº 780 - Pq Industrial San Jose</div>
                      <div>CEP 06715-862 - (11) 3500-2600 Opção 1</div>
                      {fechamento.trim() !== DEFAULT_EMAIL_FECHAMENTO.trim() && (
                        <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-[11px] text-slate-500 whitespace-pre-wrap">
                          {fechamento}
                        </div>
                      )}
                    </div>

                    {/* Linha Todos os direitos reservados + Aviso de Confidencialidade em Bloco Único (fonte menor 9.5-10px cinza) */}
                    <div className="pt-4 border-t border-slate-100 font-sans">
                      <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                        {DIREITOS_RESERVADOS_TEXT}
                      </div>
                      <div className="text-[9.5px] leading-relaxed text-slate-500 text-justify">
                        {CONFIDENCIALIDADE_BLOCO_UNIFICADO}
                      </div>
                    </div>
                  </div>
                  {/* Rodapé institucional */}
                  <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
                    Roland DG Brasil • Todos os direitos reservados.
                  </div>{' '}
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  * Exemplo simulado com o primeiro destinatário da lista (
                  {destinatariosFinais[0]?.nome || 'Contato'}).
                </p>

                {/* Lista de anexos na revisão */}
                <div className="border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-700 text-xs block mb-1.5 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                    <span>Anexos da Campanha ({anexos.length}):</span>
                  </span>
                  {anexos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {anexos.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-1.5 px-2 bg-white rounded border border-slate-200 text-xs truncate"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate text-slate-700 font-medium" title={f.name}>
                            {f.name}
                          </span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            ({(f.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem anexos</span>
                  )}
                </div>
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
                {canWrite ? (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenSaveTemplateModal}
                      disabled={isSubmitting || isSavingModel}
                      className="px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-1.5 disabled:opacity-50"
                      title="Salva na coleção de modelos reutilizáveis pedindo o nome"
                    >
                      {isSavingModel ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>Salvar como Modelo / Template</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenConfirmModal}
                      disabled={isSubmitting || isCheckingDuplicate}
                      className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isCheckingDuplicate ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>
                        {isCheckingDuplicate
                          ? 'Verificando duplicidades...'
                          : 'Confirmar e Iniciar Disparo'}
                      </span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 italic bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                    Modo somente leitura (perfil Consulta): envio e modelos desabilitados.
                  </span>
                )}
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

      {/* MODAL DE AVISO DE DISPARO DUPLICADO NAS ÚLTIMAS 24 HORAS */}
      {duplicateCampanhaWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 w-full max-w-lg p-6 space-y-4 scale-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Atenção: Comunicado idêntico já disparado recentemente!
              </h3>
              <p className="text-xs text-slate-600">
                Este comunicado já foi disparado hoje às{' '}
                <strong className="text-slate-900 font-mono">
                  {new Date(duplicateCampanhaWarning.created).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>{' '}
                (em{' '}
                {new Date(duplicateCampanhaWarning.created).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
                ) para{' '}
                <strong className="text-slate-900">
                  {duplicateCampanhaWarning.quantidade_destinatarios || '—'} destinatários
                </strong>
                .
              </p>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs space-y-1.5 text-left">
              <div className="text-[11px] text-amber-900">
                <span className="font-semibold">Campanha anterior:</span>{' '}
                {duplicateCampanhaWarning.nome || duplicateCampanhaWarning.assunto}
              </div>
              <div className="text-[11px] text-amber-900">
                <span className="font-semibold">Status:</span>{' '}
                <span className="font-medium">{duplicateCampanhaWarning.status}</span>
              </div>
              <div className="text-[11px] text-amber-900">
                <span className="font-semibold">Assunto:</span> {duplicateCampanhaWarning.assunto}
              </div>
              <div className="pt-1 text-[11px] text-amber-800 font-medium">
                Deseja disparar novamente mesmo assim?
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDuplicateCampanhaWarning(null)
                  setStep(2)
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Revisar mensagem
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateCampanhaWarning(null)
                  setIsConfirmModalOpen(true)
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm shadow-amber-500/20 transition-all"
              >
                Disparar mesmo assim
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

            {/* Mensagem amigável de retry/backoff se o servidor estiver sob carga */}
            {retryStatusMessage && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] flex items-center gap-2 text-left animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0 text-blue-600" />
                <span>{retryStatusMessage}</span>
              </div>
            )}

            {/* Progresso de Enfileiramento em Lotes */}
            {enfileiramentoProgresso && (
              <div className="space-y-1.5 pt-1 text-left">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span>Enfileirando destinatários de forma segura:</span>
                  <span className="font-mono text-blue-600">
                    {enfileiramentoProgresso.atual} / {enfileiramentoProgresso.total}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (enfileiramentoProgresso.atual / enfileiramentoProgresso.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Idempotência ativa: verificando duplicidades e controlando cadência do servidor.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              {isSubmitting ? (
                <button
                  type="button"
                  onClick={handleAbortEnfileiramento}
                  className="px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  Interromper Enfileiramento
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmAndSend}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {enfileiramentoProgresso
                        ? `Enfileirando (${enfileiramentoProgresso.atual}/${enfileiramentoProgresso.total})...`
                        : 'Enfileirando...'}
                    </span>
                  </>
                ) : (
                  <span>Sim, Confirmar Disparo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: SALVAR COMO MODELO / TEMPLATE (PEDE NOME E VALIDA CONFLITOS) */}
      {isSaveModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>Salvar como Modelo / Template</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSavingModel) {
                    setIsSaveModelModalOpen(false)
                    setSaveModelConflict(null)
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Modelo *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={saveModelNome}
                  onChange={(e) => {
                    setSaveModelNome(e.target.value)
                    if (saveModelConflict) setSaveModelConflict(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleConfirmSaveTemplate(false)
                    }
                  }}
                  placeholder="Ex: Comunicado Mensal Linha TruVIS"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nome único para identificar este modelo na lista de modelos salvos.
                </p>
              </div>

              {/* AVISO DE CONFLITO / SOBRESCRITA */}
              {saveModelConflict && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-xs font-semibold">
                        Já existe um modelo chamado &quot;{saveModelConflict.nome}&quot;
                      </strong>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Deseja sobrescrever (atualizar) o modelo existente com o conteúdo atual ou
                        prefere cancelar para escolher outro nome?
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60">
                    <button
                      type="button"
                      onClick={() => setSaveModelConflict(null)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white rounded border border-slate-200 bg-white"
                    >
                      Mudar Nome
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmSaveTemplate(true)}
                      disabled={isSavingModel}
                      className="px-3 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      {isSavingModel && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>Sobrescrever Modelo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!saveModelConflict && (
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveModelModalOpen(false)}
                  disabled={isSavingModel}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSaveTemplate(false)}
                  disabled={isSavingModel || !saveModelNome.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingModel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Salvar Modelo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DE MODELO */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Excluir o modelo &quot;{templateToDelete.nome}&quot;?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta ação não pode ser desfeita. O modelo será apagado do banco de dados e removido
                da lista de templates.
              </p>
              <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                Se este modelo estiver carregado no editor neste momento, o texto atual permanecerá
                intacto para você continuar trabalhando.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingModel) setTemplateToDelete(null)
                }}
                disabled={isDeletingModel}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTemplate}
                disabled={isDeletingModel}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingModel ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Sim, Excluir Modelo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
