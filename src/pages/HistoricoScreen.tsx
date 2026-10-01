import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  History,
  Download,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Eye,
  Loader2,
  X,
  Search,
  Trash2,
  AlertTriangle,
  Paperclip,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Layers,
  Building2,
  Radio,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { comunicacoesService, auxiliaresService, revendasService } from '@/services/apiService'
import { exportToCSV } from '@/lib/exportCsv'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Envio, Campanha, Revenda, CanalFaturamento } from '@/types'
import { useFloatingHorizontalScroll } from '@/hooks/useFloatingHorizontalScroll'
import { FloatingHorizontalScrollbar } from '@/components/FloatingHorizontalScrollbar'

export type HistoricoSortField =
  | 'data_envio'
  | 'campanha'
  | 'contato'
  | 'revenda'
  | 'canal'
  | 'email'
  | 'status'
  | 'tentativas'

export type HistoricoGroupBy = 'none' | 'canal' | 'revenda'

export interface EnviosGroup {
  groupId: string
  groupTitle: string
  subTitle?: string
  badgeText?: string
  envios: Envio[]
  isUnassigned?: boolean
  errosCount: number
}

export const HistoricoScreen: React.FC = () => {
  const { toast } = useToast()
  const { canWrite, isAdmin } = useAuth()
  const [, startTransition] = useTransition()
  const [searchParams] = useSearchParams()

  const [envios, setEnvios] = useState<Envio[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [canais, setCanais] = useState<CanalFaturamento[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [filterCampanha, setFilterCampanha] = useState('all')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [searchGeral, setSearchGeral] = useState('')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  // Ordenação de colunas
  const [sortField, setSortField] = useState<HistoricoSortField>('data_envio')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Agrupamento colapsável
  const [groupBy, setGroupBy] = useState<HistoricoGroupBy>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [groupPage, setGroupPage] = useState(1)
  const [groupsPerPage, setGroupsPerPage] = useState<number | 'all'>('all')

  // Modal Detalhes do Envio / Campanha
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null)

  // Reenvio individual (modal de confirmação)
  const [envioParaReenviar, setEnvioParaReenviar] = useState<Envio | null>(null)
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)

  // Exclusão individual de falha (modal de confirmação)
  const [envioParaExcluir, setEnvioParaExcluir] = useState<Envio | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  // Reenvio em lote de erros da campanha filtrada
  const [isLoteModalOpen, setIsLoteModalOpen] = useState(false)
  const [isReenviandoLote, setIsReenviandoLote] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [eList, cList, rList, canList] = await Promise.all([
        comunicacoesService.getAllEnvios(),
        comunicacoesService.listCampanhas(),
        revendasService.getAll().catch(() => [] as Revenda[]),
        auxiliaresService.getCanaisFaturamento().catch(() => [] as CanalFaturamento[]),
      ])

      setEnvios(eList)
      setCampanhas(cList)
      setRevendas(rList)
      setCanais(canList)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mapas auxiliares para resolução ágil de revenda e canal de faturamento
  const revendasMap = useMemo(() => {
    const map = new Map<string, Revenda>()
    for (const r of revendas) map.set(r.id, r)
    return map
  }, [revendas])

  const canaisMap = useMemo(() => {
    const map = new Map<string, CanalFaturamento>()
    for (const c of canais) map.set(c.id, c)
    return map
  }, [canais])

  // Helper para obter o canal de faturamento da linha do envio
  // Snapshot textual do envio tem prioridade; em seguida join com revenda vinculada
  const getCanalDoEnvio = (e: Envio): { id: string; nome: string } => {
    // 1. Snapshot direto se vier de revenda vinculada ou campo customizado
    const rev = (e.revenda ? revendasMap.get(e.revenda) : null) || e.expand?.revenda
    if (rev?.canal_faturamento) {
      const canalObj = canaisMap.get(rev.canal_faturamento)
      if (canalObj) {
        return { id: canalObj.id, nome: canalObj.nome }
      }
    }
    // 2. Campo texto canal na revenda
    if (rev?.canal) {
      return { id: rev.canal, nome: rev.canal }
    }
    if (rev?.canais) {
      return { id: rev.canais, nome: rev.canais }
    }
    return { id: 'sem_canal', nome: 'Sem canal' }
  }

  // Helper para obter a revenda do envio
  const getRevendaDoEnvio = (
    e: Envio,
  ): { id: string; nome: string; codigo?: string; isUnassigned: boolean } => {
    const revId = e.revenda || e.expand?.revenda?.id
    const revNome = e.nome_revenda || e.expand?.revenda?.nome
    const revCodigo = e.codigo_revenda || e.expand?.revenda?.codigo

    if (!revId && !revNome) {
      return { id: 'sem_revenda', nome: 'Sem revenda', isUnassigned: true }
    }

    return {
      id: revId || `rev_${revNome}`,
      nome: revNome || 'Revenda não identificada',
      codigo: revCodigo || undefined,
      isUnassigned: false,
    }
  }

  // Filtragem
  const filteredEnvios = useMemo(() => {
    return envios.filter((e) => {
      if (filterCampanha !== 'all' && e.campanha !== filterCampanha) return false
      if (filterStatus !== 'all' && e.status !== filterStatus) return false
      if (filterDataInicio) {
        const itemDate = new Date(e.data_envio || e.created).toISOString().substring(0, 10)
        if (itemDate < filterDataInicio) return false
      }
      if (filterDataFim) {
        const itemDate = new Date(e.data_envio || e.created).toISOString().substring(0, 10)
        if (itemDate > filterDataFim) return false
      }
      if (searchGeral.trim()) {
        const q = searchGeral.toLowerCase().trim()
        const codigoRev = (e.codigo_revenda || e.expand?.revenda?.codigo || '').toLowerCase()
        const nomeRev = (e.nome_revenda || e.expand?.revenda?.nome || '').toLowerCase()
        const nomeCont = (e.nome_contato || e.expand?.contato?.nome || '').toLowerCase()
        const matchCodigo = codigoRev.includes(q)
        const matchRevenda = nomeRev.includes(q)
        const matchContato = nomeCont.includes(q)
        const matchEmail = e.email_utilizado?.toLowerCase().includes(q)
        const matchCampanha = e.expand?.campanha?.nome?.toLowerCase().includes(q)
        const matchAssunto = e.expand?.campanha?.assunto?.toLowerCase().includes(q)
        const matchCanal = getCanalDoEnvio(e).nome.toLowerCase().includes(q)
        if (
          !matchCodigo &&
          !matchRevenda &&
          !matchContato &&
          !matchEmail &&
          !matchCampanha &&
          !matchAssunto &&
          !matchCanal
        ) {
          return false
        }
      }
      return true
    })
  }, [
    envios,
    filterCampanha,
    filterStatus,
    filterDataInicio,
    filterDataFim,
    searchGeral,
    revendasMap,
    canaisMap,
  ])

  // Ordenação de colunas sobre os registros filtrados
  const sortedEnvios = useMemo(() => {
    const list = [...filteredEnvios]
    const dirMult = sortDir === 'asc' ? 1 : -1

    return list.sort((a, b) => {
      let valA = ''
      let valB = ''

      switch (sortField) {
        case 'data_envio': {
          const dateA = new Date(a.data_envio || a.created).getTime() || 0
          const dateB = new Date(b.data_envio || b.created).getTime() || 0
          return (dateA - dateB) * dirMult
        }
        case 'campanha':
          valA = (a.expand?.campanha?.assunto || a.expand?.campanha?.nome || '').toLowerCase()
          valB = (b.expand?.campanha?.assunto || b.expand?.campanha?.nome || '').toLowerCase()
          break
        case 'contato':
          valA = (a.nome_contato || a.expand?.contato?.nome || '').toLowerCase()
          valB = (b.nome_contato || b.expand?.contato?.nome || '').toLowerCase()
          break
        case 'revenda':
          valA = (a.nome_revenda || a.expand?.revenda?.nome || '').toLowerCase()
          valB = (b.nome_revenda || b.expand?.revenda?.nome || '').toLowerCase()
          break
        case 'canal':
          valA = getCanalDoEnvio(a).nome.toLowerCase()
          valB = getCanalDoEnvio(b).nome.toLowerCase()
          break
        case 'email':
          valA = (a.email_utilizado || '').toLowerCase()
          valB = (b.email_utilizado || '').toLowerCase()
          break
        case 'status':
          valA = (a.status || '').toLowerCase()
          valB = (b.status || '').toLowerCase()
          break
        case 'tentativas': {
          // Status Enviado tem sucesso de tentativa única; Erro com mensagem tem tentativa falhada
          const numA =
            (a as unknown as { tentativas?: number }).tentativas ??
            (a.status === 'Erro' ? 1 : a.status === 'Enviado' ? 1 : 0)
          const numB =
            (b as unknown as { tentativas?: number }).tentativas ??
            (b.status === 'Erro' ? 1 : b.status === 'Enviado' ? 1 : 0)
          return (numA - numB) * dirMult
        }
        default:
          return 0
      }

      return valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base', numeric: true }) * dirMult
    })
  }, [filteredEnvios, sortField, sortDir, revendasMap, canaisMap])

  // Agrupamento colapsável
  const allGroups = useMemo(() => {
    if (groupBy === 'none') return []

    const groups: EnviosGroup[] = []
    const groupMap = new Map<string, EnviosGroup>()

    for (const env of sortedEnvios) {
      let gId = ''
      let gTitle = ''
      let subTitle: string | undefined = undefined
      let badgeText: string | undefined = undefined
      let isUnassigned = false

      if (groupBy === 'canal') {
        const canalInfo = getCanalDoEnvio(env)
        gId = canalInfo.id
        gTitle = canalInfo.nome
        badgeText = 'Canal de Faturamento'
        if (gId === 'sem_canal') {
          isUnassigned = true
        }
      } else {
        // 'revenda'
        const revInfo = getRevendaDoEnvio(env)
        gId = revInfo.id
        gTitle = revInfo.nome
        subTitle = revInfo.codigo ? `Cód: ${revInfo.codigo}` : undefined
        badgeText = 'Revenda'
        isUnassigned = revInfo.isUnassigned
      }

      let grp = groupMap.get(gId)
      if (!grp) {
        grp = {
          groupId: gId,
          groupTitle: gTitle,
          subTitle,
          badgeText,
          envios: [],
          isUnassigned,
          errosCount: 0,
        }
        groupMap.set(gId, grp)
        groups.push(grp)
      }

      grp.envios.push(env)
      if (env.status === 'Erro') {
        grp.errosCount++
      }
    }

    return groups
  }, [sortedEnvios, groupBy, revendasMap, canaisMap])

  // Grupos exibidos na página atual no modo agrupado
  const displayedGroups = useMemo(() => {
    if (groupsPerPage === 'all') {
      return allGroups
    }
    const start = (groupPage - 1) * groupsPerPage
    return allGroups.slice(start, start + groupsPerPage)
  }, [allGroups, groupPage, groupsPerPage])

  const totalEnviosVisiveisNoAgrupado = useMemo(() => {
    return displayedGroups.reduce((acc, g) => acc + g.envios.length, 0)
  }, [displayedGroups])

  const handleToggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  const handleExpandAll = () => {
    setCollapsedGroups({})
  }

  const handleCollapseAll = () => {
    setGroupsPerPage('all')
    setGroupPage(1)
    const newState: Record<string, boolean> = {}
    for (const g of allGroups) {
      newState[g.groupId] = true
    }
    setCollapsedGroups(newState)
  }

  const allCollapsed =
    displayedGroups.length > 0 && displayedGroups.every((g) => !!collapsedGroups[g.groupId])

  // Paginação no modo Lista Plana
  const totalPages = Math.ceil(sortedEnvios.length / perPage) || 1
  const paginatedEnvios = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return sortedEnvios.slice(start, start + perPage)
  }, [sortedEnvios, currentPage, perPage])

  // =========================================================================
  // BARRA DE ROLAGEM HORIZONTAL FIXA/ESPELHADA (Sticky Scrollbar)
  // Sincroniza o scrollLeft da tabela principal com uma barra flutuante no rodapé
  // visível da viewport, permitindo rolar horizontalmente sem descer a página até o fim.
  // =========================================================================
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const {
    stickyScrollRef,
    hasHorizontalOverflow,
    scrollWidth,
    stickyVisible,
    stickyBottom,
    stickyLeft,
    stickyWidth,
    handleTableScroll,
    handleStickyScroll,
  } = useFloatingHorizontalScroll({
    tableContainerRef,
    deps: [
      sortedEnvios.length,
      groupBy,
      groupPage,
      groupsPerPage,
      currentPage,
      perPage,
      collapsedGroups,
      isLoading,
    ],
  })

  const handleSort = (field: HistoricoSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'data_envio' ? 'desc' : 'asc')
    }
  }

  // Executar reenvio individual confirmado
  const handleConfirmReenviar = async () => {
    if (!envioParaReenviar || !canWrite) {
      toast({
        title: 'Ação não permitida',
        description:
          'Usuários com perfil Consulta não possuem permissão para reenviar comunicações.',
        variant: 'destructive',
      })
      return
    }
    const alvo = envioParaReenviar
    setReenviandoId(alvo.id)
    setEnvioParaReenviar(null)

    // Atualização otimista: colocar em 'Pendente' visualmente enquanto o SMTP processa
    setEnvios((prev) =>
      prev.map((item) =>
        item.id === alvo.id
          ? {
              ...item,
              status: 'Pendente',
              erro: false,
              mensagem_erro: 'Reenviando via SMTP...',
            }
          : item,
      ),
    )

    try {
      // 1. Atualizar o envio existente para 'Pendente' para ser reprocessado
      await pb.collection('envios').update(alvo.id, {
        status: 'Pendente',
        erro: false,
        sucesso: false,
        mensagem_erro: '',
      })

      // 2. Disparar processamento imediato no backend para este envio específico
      const res = await comunicacoesService.triggerProcessarEnvios(alvo.campanha, alvo.id)

      // 3. Buscar o registro atualizado do banco para refletir a resposta exata do servidor
      const envioAtualizado = await comunicacoesService.getEnvioById(alvo.id)

      setEnvios((prev) => prev.map((item) => (item.id === alvo.id ? envioAtualizado : item)))

      if (selectedEnvio && selectedEnvio.id === alvo.id) {
        setSelectedEnvio(envioAtualizado)
      }

      if (envioAtualizado.status === 'Enviado') {
        toast({
          title: 'Mensagem reenviada com sucesso!',
          description: `Disparo entregue para ${alvo.email_utilizado}.`,
          variant: 'default',
        })
      } else {
        toast({
          title: 'Falha no reenvio',
          description:
            envioAtualizado.mensagem_erro ||
            res.ultimaMensagemErro ||
            'O servidor retornou um erro ao tentar reenviar.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      console.error('Erro ao reenviar:', err)
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o servidor'
      toast({
        title: 'Erro no reenvio',
        description: msg,
        variant: 'destructive',
      })
      // Recarregar estado real
      await loadData()
    } finally {
      setReenviandoId(null)
    }
  }

  // Executar exclusão de envio com falha (restrito a Admin)
  const handleConfirmExcluir = async () => {
    if (!envioParaExcluir || !isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas Administradores podem excluir registros com falha do histórico.',
        variant: 'destructive',
      })
      return
    }
    const alvo = envioParaExcluir
    setExcluindoId(alvo.id)
    setEnvioParaExcluir(null)

    try {
      await comunicacoesService.deleteEnvio(alvo.id)

      setEnvios((prev) => prev.filter((item) => item.id !== alvo.id))

      if (selectedEnvio && selectedEnvio.id === alvo.id) {
        setSelectedEnvio(null)
      }

      toast({
        title: 'Registro de falha excluído com sucesso',
        description: `O registro de falha para ${alvo.email_utilizado || 'o destinatário'} foi removido do Histórico e auditado.`,
        variant: 'default',
      })
    } catch (err: unknown) {
      console.error('Erro ao excluir envio com falha:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao excluir o registro de falha'
      toast({
        title: 'Erro na exclusão',
        description: msg,
        variant: 'destructive',
      })
      await loadData()
    } finally {
      setExcluindoId(null)
    }
  }

  // Executar reenvio em lote de envios com erro da campanha selecionada
  const handleConfirmReenviarLote = async () => {
    if (!canWrite || filterCampanha === 'all') {
      toast({
        title: 'Ação não permitida',
        description:
          'Usuários com perfil Consulta não possuem permissão para reprocessar envios em lote.',
        variant: 'destructive',
      })
      return
    }
    setIsReenviandoLote(true)
    setIsLoteModalOpen(false)

    try {
      const errosDaCampanha = envios.filter(
        (e) => e.campanha === filterCampanha && e.status === 'Erro',
      )
      if (errosDaCampanha.length === 0) {
        toast({
          title: 'Nenhum envio com erro',
          description: 'Esta campanha não possui envios pendentes ou com erro para reprocessar.',
        })
        return
      }

      // Atualizar todos com erro para Pendente
      for (const e of errosDaCampanha) {
        await pb.collection('envios').update(e.id, {
          status: 'Pendente',
          erro: false,
          sucesso: false,
          mensagem_erro: '',
        })
      }

      // Disparar processamento da campanha inteira
      const res = await comunicacoesService.triggerProcessarEnvios(filterCampanha)

      toast({
        title: 'Reenvio em lote concluído',
        description: `Processados: ${res.totalProcessados}. Erros: ${res.totalErros}.`,
        variant: res.totalErros > 0 ? 'destructive' : 'default',
      })

      await loadData()
    } catch (err: unknown) {
      console.error(err)
      toast({
        title: 'Erro ao processar lote',
        description: 'Não foi possível reprocessar os envios da campanha.',
        variant: 'destructive',
      })
    } finally {
      setIsReenviandoLote(false)
    }
  }

  const handleExportCSV = () => {
    const dataToExport = sortedEnvios.map((e) => ({
      campanha: e.expand?.campanha?.nome || '',
      assunto: e.expand?.campanha?.assunto || '',
      data_envio: e.data_envio
        ? new Date(e.data_envio).toLocaleString('pt-BR')
        : new Date(e.created).toLocaleString('pt-BR'),
      usuario:
        e.expand?.campanha?.expand?.usuario?.name ||
        e.expand?.campanha?.expand?.usuario?.email ||
        '',
      revenda: e.nome_revenda || e.expand?.revenda?.nome || '',
      codigo_revenda: e.codigo_revenda || e.expand?.revenda?.codigo || '',
      canal: getCanalDoEnvio(e).nome,
      contato: e.nome_contato || e.expand?.contato?.nome || '',
      email: e.email_utilizado || '',
      status: e.status,
      tentativas:
        (e as unknown as { tentativas?: number }).tentativas || (e.status === 'Erro' ? 1 : 1),
      sucesso: e.sucesso ? 'Sim' : 'Não',
      erro: e.erro ? 'Sim' : 'Não',
      mensagem_erro: e.mensagem_erro || '',
    }))

    exportToCSV('historico_envios_export', dataToExport, [
      { key: 'campanha', label: 'Campanha' },
      { key: 'assunto', label: 'Assunto' },
      { key: 'data_envio', label: 'Data/Hora' },
      { key: 'usuario', label: 'Usuário Responsável' },
      { key: 'revenda', label: 'Revenda' },
      { key: 'codigo_revenda', label: 'Código da Revenda' },
      { key: 'canal', label: 'Canal' },
      { key: 'contato', label: 'Contato' },
      { key: 'email', label: 'E-mail Utilizado' },
      { key: 'status', label: 'Status' },
      { key: 'tentativas', label: 'Tentativas' },
      { key: 'sucesso', label: 'Sucesso' },
      { key: 'erro', label: 'Erro' },
      { key: 'mensagem_erro', label: 'Mensagem de Erro' },
    ])
  }

  const limparFiltros = () => {
    startTransition(() => {
      setFilterCampanha('all')
      setFilterStatus('all')
      setFilterDataInicio('')
      setFilterDataFim('')
      setSearchGeral('')
      setCurrentPage(1)
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Enviado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>Enviado</span>
          </span>
        )
      case 'Erro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" />
            <span>Erro</span>
          </span>
        )
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <span>Cancelado</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" />
            <span>Pendente</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!canWrite && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-slate-700 text-xs">
          <AlertTriangle className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-semibold text-slate-800 mb-0.5">
              Histórico em Modo de Consulta
            </strong>
            Você está visualizando o histórico com permissão exclusiva de leitura. As ações de
            reenvio individual, reenvio em lote e exclusão estão desabilitadas para o seu perfil.
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Histórico de Disparos</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro auditável de cada mensagem enviada, status individual e diagnóstico de falhas
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canWrite && filterCampanha !== 'all' && (
            <button
              onClick={() => setIsLoteModalOpen(true)}
              disabled={
                isReenviandoLote ||
                envios.filter((e) => e.campanha === filterCampanha && e.status === 'Erro')
                  .length === 0
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
              title="Reenviar todos os envios com erro desta campanha"
            >
              {isReenviandoLote ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              ) : (
                <RotateCw className="h-4 w-4 text-amber-600" />
              )}
              <span>
                Reenviar Erros da Campanha (
                {envios.filter((e) => e.campanha === filterCampanha && e.status === 'Erro').length})
              </span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Exportar Histórico (CSV)</span>
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Filtros do Histórico</span>
          </div>
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Busca Código/Revenda/Contato */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Busca (Cód. Revenda / Nome)
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchGeral}
                onChange={(e) => {
                  setSearchGeral(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Ex: C00099, Nome, E-mail..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Campanha */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Campanha</label>
            <select
              value={filterCampanha}
              onChange={(e) => {
                setFilterCampanha(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todas as campanhas</option>
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Status do Envio
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os status</option>
              <option value="Enviado">Enviado (Sucesso)</option>
              <option value="Erro">Erro no Disparo</option>
              <option value="Pendente">Pendente na Fila</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filterDataInicio}
              onChange={(e) => {
                setFilterDataInicio(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Data Fim</label>
            <input
              type="date"
              value={filterDataFim}
              onChange={(e) => {
                setFilterDataFim(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* BARRA DE AGRUPAMENTO COLAPSÁVEL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-700 whitespace-nowrap">Agrupar por:</span>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as HistoricoGroupBy)
                setGroupPage(1)
                setCollapsedGroups({})
              }}
              className="py-1 px-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Sem agrupamento (Lista Plana)</option>
              <option value="canal">Agrupar por Canal</option>
              <option value="revenda">Agrupar por Revenda</option>
            </select>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <span className="text-slate-500">
            {groupBy !== 'none' ? (
              <>
                {groupsPerPage === 'all' ? (
                  <>
                    Exibindo todos os <strong className="text-slate-800">{allGroups.length}</strong>{' '}
                    {groupBy === 'canal' ? 'canais de faturamento' : 'grupos de revendas'} nesta
                    página (<strong className="text-slate-800">{sortedEnvios.length}</strong>{' '}
                    envios)
                  </>
                ) : (
                  <>
                    <strong className="text-slate-800">{displayedGroups.length}</strong> de{' '}
                    <strong className="text-slate-800">{allGroups.length}</strong> grupos nesta
                    página ({totalEnviosVisiveisNoAgrupado} envios visíveis)
                  </>
                )}
              </>
            ) : (
              <>
                Modo lista plana: <strong className="text-slate-800">{sortedEnvios.length}</strong>{' '}
                envios filtrados
              </>
            )}
          </span>
        </div>

        {groupBy !== 'none' && allGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allCollapsed ? handleExpandAll : handleCollapseAll}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors shadow-xs"
            >
              {allCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  <span>Expandir todas</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  <span>Colapsar todas (ver tudo)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              disabled={Object.keys(collapsedGroups).length === 0}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors shadow-xs disabled:opacity-40"
            >
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              <span>Expandir todas</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              disabled={allCollapsed}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors shadow-xs disabled:opacity-40"
              title="Colapsa todos os grupos e exibe todos em uma única página"
            >
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              <span>Colapsar todas</span>
            </button>
          </div>
        )}
      </div>

      {/* TABELA DE ENVIOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {/* 1. Data/Hora */}
                <th
                  onClick={() => handleSort('data_envio')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Data/Hora"
                >
                  <div className="flex items-center gap-1">
                    <span>Data/Hora</span>
                    {sortField === 'data_envio' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 2. Campanha (assunto) */}
                <th
                  onClick={() => handleSort('campanha')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Campanha / Assunto"
                >
                  <div className="flex items-center gap-1">
                    <span>Campanha / Assunto</span>
                    {sortField === 'campanha' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 3. Destinatário (contato) */}
                <th
                  onClick={() => handleSort('contato')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Contato"
                >
                  <div className="flex items-center gap-1">
                    <span>Destinatário</span>
                    {sortField === 'contato' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 4. Revenda */}
                <th
                  onClick={() => handleSort('revenda')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Revenda"
                >
                  <div className="flex items-center gap-1">
                    <span>Revenda</span>
                    {sortField === 'revenda' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 5. Canal de Faturamento */}
                <th
                  onClick={() => handleSort('canal')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Canal de Faturamento"
                >
                  <div className="flex items-center gap-1">
                    <span>Canal</span>
                    {sortField === 'canal' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 6. E-mail */}
                <th
                  onClick={() => handleSort('email')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por E-mail"
                >
                  <div className="flex items-center gap-1">
                    <span>E-mail Utilizado</span>
                    {sortField === 'email' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 7. Status */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Status"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 8. Tentativas */}
                <th
                  onClick={() => handleSort('tentativas')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap text-center"
                  title="Ordenar por Tentativas"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Tentativas</span>
                    {sortField === 'tentativas' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Diagnóstico */}
                <th className="py-3 px-3">Diagnóstico</th>

                {/* Ações */}
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando histórico de envios...</span>
                  </td>
                </tr>
              ) : sortedEnvios.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>Nenhum envio registrado no histórico.</span>
                  </td>
                </tr>
              ) : groupBy === 'none' ? (
                // MODO LISTA PLANA
                paginatedEnvios.map((env) => {
                  const canal = getCanalDoEnvio(env)
                  const tentativas =
                    (env as unknown as { tentativas?: number }).tentativas ||
                    (env.status === 'Erro' ? 1 : 1)
                  return (
                    <tr key={env.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Data */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                        {env.data_envio
                          ? new Date(env.data_envio).toLocaleString('pt-BR')
                          : new Date(env.created).toLocaleString('pt-BR')}
                      </td>

                      {/* 2. Campanha */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate">
                            {env.expand?.campanha?.nome || 'Campanha'}
                          </span>
                          {env.expand?.campanha?.anexos &&
                            env.expand.campanha.anexos.length > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex-shrink-0"
                                title={`${env.expand.campanha.anexos.length} anexo(s) nesta campanha`}
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                <span>{env.expand.campanha.anexos.length}</span>
                              </span>
                            )}
                        </div>
                        <span className="text-[11px] text-slate-500 truncate block">
                          {env.expand?.campanha?.assunto || '—'}
                        </span>
                      </td>

                      {/* 3. Contato (destinatário) */}
                      <td className="py-3 px-3 text-slate-800 font-semibold whitespace-nowrap">
                        {env.nome_contato || env.expand?.contato?.nome || '—'}
                      </td>

                      {/* 4. Revenda */}
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-medium text-slate-900">
                          {env.nome_revenda || env.expand?.revenda?.nome || '—'}
                        </div>
                        {(env.codigo_revenda || env.expand?.revenda?.codigo) && (
                          <span className="font-mono text-[10px] text-slate-500">
                            Cód: {env.codigo_revenda || env.expand?.revenda?.codigo}
                          </span>
                        )}
                      </td>

                      {/* 5. Canal */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            canal.id === 'sem_canal'
                              ? 'bg-slate-50 text-slate-500 border-slate-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {canal.nome}
                        </span>
                      </td>

                      {/* 6. E-mail */}
                      <td className="py-3 px-3 font-mono text-blue-700 break-all">
                        {env.email_utilizado || '—'}
                      </td>

                      {/* 7. Status */}
                      <td className="py-3 px-3 whitespace-nowrap">{getStatusBadge(env.status)}</td>

                      {/* 8. Tentativas */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                          {tentativas}
                        </span>
                      </td>

                      {/* 9. Diagnóstico */}
                      <td className="py-3 px-3 max-w-[200px]">
                        {env.erro && env.mensagem_erro ? (
                          <span
                            className="text-[11px] text-red-600 font-medium truncate block"
                            title={env.mensagem_erro}
                          >
                            {env.mensagem_erro}
                          </span>
                        ) : env.mensagem_erro && env.mensagem_erro.includes('Simulado') ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                            title={env.mensagem_erro}
                          >
                            Simulado — nenhum e-mail enviado de fato
                          </span>
                        ) : env.sucesso ? (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Auditado com sucesso
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Aguardando</span>
                        )}
                      </td>

                      {/* 10. Ações */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canWrite && (env.status === 'Erro' || env.status === 'Enviado') && (
                            <button
                              type="button"
                              onClick={() => setEnvioParaReenviar(env)}
                              disabled={
                                reenviandoId === env.id ||
                                isReenviandoLote ||
                                excluindoId === env.id
                              }
                              title={
                                env.status === 'Enviado'
                                  ? 'Reenviar mensagem (já entregue)'
                                  : 'Reenviar mensagem para este destinatário'
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 ${
                                env.status === 'Enviado'
                                  ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 hover:border-sky-300'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:border-amber-300'
                              }`}
                            >
                              {reenviandoId === env.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-current" />
                              ) : (
                                <RotateCw className="h-3 w-3 text-current" />
                              )}
                              <span>Reenviar</span>
                            </button>
                          )}

                          {isAdmin && env.status === 'Erro' && (
                            <button
                              type="button"
                              onClick={() => setEnvioParaExcluir(env)}
                              disabled={excluindoId === env.id || reenviandoId === env.id}
                              title="Excluir registro com falha do histórico"
                              className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-40"
                            >
                              {excluindoId === env.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedEnvio(env)}
                            title="Ver detalhes da comunicação"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Detalhes</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                // MODO AGRUPADO COLAPSÁVEL (POR CANAL OU POR REVENDA)
                displayedGroups.map((group) => {
                  const isCollapsed = !!collapsedGroups[group.groupId]
                  return (
                    <React.Fragment key={`group-${group.groupId}`}>
                      {/* CABEÇALHO DO GRUPO */}
                      <tr className="bg-slate-100/90 border-y border-slate-200 hover:bg-slate-200/70 transition-colors">
                        <td colSpan={10} className="py-2.5 px-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleCollapse(group.groupId)}
                              className="flex items-center gap-2.5 text-left font-bold text-slate-900 hover:text-blue-600 select-none group/btn"
                            >
                              <span className="p-1 rounded bg-white border border-slate-200 text-slate-600 group-hover/btn:border-blue-300 group-hover/btn:text-blue-600 transition-colors shadow-2xs">
                                {isCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </span>

                              <div className="flex items-center gap-2 flex-wrap">
                                {groupBy === 'canal' ? (
                                  <Radio className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Building2 className="h-4 w-4 text-blue-600" />
                                )}
                                <span className="text-xs tracking-tight">{group.groupTitle}</span>

                                {group.subTitle && (
                                  <span className="font-mono text-[10px] font-bold bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                                    {group.subTitle}
                                  </span>
                                )}

                                {group.badgeText && (
                                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                    {group.badgeText}
                                  </span>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-2.5">
                              {group.errosCount > 0 && (
                                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 shadow-2xs flex items-center gap-1">
                                  <XCircle className="h-3 w-3 text-rose-600" />
                                  <span>
                                    {group.errosCount} {group.errosCount === 1 ? 'erro' : 'erros'}
                                  </span>
                                </span>
                              )}

                              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                                {group.envios.length}{' '}
                                {group.envios.length === 1 ? 'envio' : 'envios'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* LINHAS DE ENVIOS DO GRUPO */}
                      {!isCollapsed &&
                        group.envios.map((env) => {
                          const canal = getCanalDoEnvio(env)
                          const tentativas =
                            (env as unknown as { tentativas?: number }).tentativas ||
                            (env.status === 'Erro' ? 1 : 1)
                          return (
                            <tr
                              key={env.id}
                              className="hover:bg-slate-50/80 transition-colors bg-white"
                            >
                              {/* 1. Data */}
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                                {env.data_envio
                                  ? new Date(env.data_envio).toLocaleString('pt-BR')
                                  : new Date(env.created).toLocaleString('pt-BR')}
                              </td>

                              {/* 2. Campanha */}
                              <td className="py-2.5 px-3 max-w-[200px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {env.expand?.campanha?.nome || 'Campanha'}
                                  </span>
                                  {env.expand?.campanha?.anexos &&
                                    env.expand.campanha.anexos.length > 0 && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex-shrink-0"
                                        title={`${env.expand.campanha.anexos.length} anexo(s) nesta campanha`}
                                      >
                                        <Paperclip className="h-2.5 w-2.5" />
                                        <span>{env.expand.campanha.anexos.length}</span>
                                      </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-slate-500 truncate block">
                                  {env.expand?.campanha?.assunto || '—'}
                                </span>
                              </td>

                              {/* 3. Contato (destinatário) */}
                              <td className="py-2.5 px-3 text-slate-800 font-semibold whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                  <span>
                                    {env.nome_contato || env.expand?.contato?.nome || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Revenda */}
                              <td className="py-2.5 px-3 text-slate-700">
                                <div className="font-medium text-slate-900">
                                  {env.nome_revenda || env.expand?.revenda?.nome || '—'}
                                </div>
                                {(env.codigo_revenda || env.expand?.revenda?.codigo) && (
                                  <span className="font-mono text-[10px] text-slate-500">
                                    Cód: {env.codigo_revenda || env.expand?.revenda?.codigo}
                                  </span>
                                )}
                              </td>

                              {/* 5. Canal */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    canal.id === 'sem_canal'
                                      ? 'bg-slate-50 text-slate-500 border-slate-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {canal.nome}
                                </span>
                              </td>

                              {/* 6. E-mail */}
                              <td className="py-2.5 px-3 font-mono text-blue-700 break-all">
                                {env.email_utilizado || '—'}
                              </td>

                              {/* 7. Status */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {getStatusBadge(env.status)}
                              </td>

                              {/* 8. Tentativas */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                                  {tentativas}
                                </span>
                              </td>

                              {/* 9. Diagnóstico */}
                              <td className="py-2.5 px-3 max-w-[200px]">
                                {env.erro && env.mensagem_erro ? (
                                  <span
                                    className="text-[11px] text-red-600 font-medium truncate block"
                                    title={env.mensagem_erro}
                                  >
                                    {env.mensagem_erro}
                                  </span>
                                ) : env.mensagem_erro && env.mensagem_erro.includes('Simulado') ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                                    title={env.mensagem_erro}
                                  >
                                    Simulado — nenhum e-mail enviado de fato
                                  </span>
                                ) : env.sucesso ? (
                                  <span className="text-[11px] text-emerald-600 font-medium">
                                    Auditado com sucesso
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Aguardando</span>
                                )}
                              </td>

                              {/* 10. Ações */}
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canWrite &&
                                    (env.status === 'Erro' || env.status === 'Enviado') && (
                                      <button
                                        type="button"
                                        onClick={() => setEnvioParaReenviar(env)}
                                        disabled={
                                          reenviandoId === env.id ||
                                          isReenviandoLote ||
                                          excluindoId === env.id
                                        }
                                        title={
                                          env.status === 'Enviado'
                                            ? 'Reenviar mensagem (já entregue)'
                                            : 'Reenviar mensagem para este destinatário'
                                        }
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 ${
                                          env.status === 'Enviado'
                                            ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 hover:border-sky-300'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:border-amber-300'
                                        }`}
                                      >
                                        {reenviandoId === env.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin text-current" />
                                        ) : (
                                          <RotateCw className="h-3 w-3 text-current" />
                                        )}
                                        <span>Reenviar</span>
                                      </button>
                                    )}

                                  {isAdmin && env.status === 'Erro' && (
                                    <button
                                      type="button"
                                      onClick={() => setEnvioParaExcluir(env)}
                                      disabled={excluindoId === env.id || reenviandoId === env.id}
                                      title="Excluir registro com falha do histórico"
                                      className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-40"
                                    >
                                      {excluindoId === env.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setSelectedEnvio(env)}
                                    title="Ver detalhes da comunicação"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>Detalhes</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BARRA DE ROLAGEM HORIZONTAL FIXA/ESPELHADA (Sticky Scrollbar) */}
        <FloatingHorizontalScrollbar
          scrollRef={stickyScrollRef}
          hasHorizontalOverflow={hasHorizontalOverflow}
          stickyVisible={stickyVisible}
          scrollWidth={scrollWidth}
          stickyLeft={stickyLeft}
          stickyWidth={stickyWidth}
          stickyBottom={stickyBottom}
          onScroll={handleStickyScroll}
          tableLabel="da tabela de histórico"
        />

        {/* PAGINAÇÃO */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            {groupBy !== 'none' ? (
              // Paginação por Grupo no modo agrupado
              <>
                <span>
                  {allGroups.length === 0 ? (
                    'Nenhum grupo encontrado'
                  ) : groupsPerPage === 'all' ? (
                    <>
                      Exibindo todos os <strong>{allGroups.length}</strong> grupos (
                      <strong>{sortedEnvios.length}</strong> envios no total)
                    </>
                  ) : (
                    <>
                      Exibindo grupos {(groupPage - 1) * groupsPerPage + 1}–
                      {Math.min(groupPage * groupsPerPage, allGroups.length)} de {allGroups.length}{' '}
                      ({totalEnviosVisiveisNoAgrupado} envios visíveis de {sortedEnvios.length} no
                      total)
                    </>
                  )}
                </span>
                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1">
                  <span>Grupos por página:</span>
                  <select
                    value={groupsPerPage === 'all' ? 'all' : String(groupsPerPage)}
                    onChange={(e) => {
                      const val = e.target.value
                      setGroupsPerPage(val === 'all' ? 'all' : Number(val))
                      setGroupPage(1)
                    }}
                    className="py-1 px-2 border border-slate-200 rounded bg-white text-slate-700 font-medium"
                  >
                    <option value="all">Todos em 1 página</option>
                    <option value="10">10 grupos</option>
                    <option value="20">20 grupos</option>
                    <option value="50">50 grupos</option>
                  </select>
                </label>
              </>
            ) : (
              // Paginação por Envio no modo Lista Plana
              <>
                <span>
                  Exibindo {sortedEnvios.length === 0 ? 0 : (currentPage - 1) * perPage + 1} até{' '}
                  {Math.min(currentPage * perPage, sortedEnvios.length)} de {sortedEnvios.length}{' '}
                  envios
                </span>
                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1">
                  <span>Linhas por página:</span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="py-1 px-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {groupBy !== 'none' ? (
              groupsPerPage !== 'all' && (
                <>
                  <button
                    onClick={() => setGroupPage((p) => Math.max(1, p - 1))}
                    disabled={groupPage === 1}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-medium text-slate-700">
                    Página {groupPage} de {Math.ceil(allGroups.length / groupsPerPage) || 1}
                  </span>
                  <button
                    onClick={() =>
                      setGroupPage((p) =>
                        Math.min(Math.ceil(allGroups.length / groupsPerPage) || 1, p + 1),
                      )
                    }
                    disabled={groupPage >= Math.ceil(allGroups.length / groupsPerPage)}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </>
              )
            ) : (
              <>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-2 font-medium text-slate-700">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL SHADCN DE CONFIRMAÇÃO DE REENVIO INDIVIDUAL */}
      <AlertDialog
        open={!!envioParaReenviar}
        onOpenChange={(open) => !open && setEnvioParaReenviar(null)}
      >
        <AlertDialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                envioParaReenviar?.status === 'Enviado'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {envioParaReenviar?.status === 'Enviado' ? (
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              ) : (
                <RotateCw className="h-5 w-5" />
              )}
            </div>
            <AlertDialogTitle className="text-base text-slate-900">
              {envioParaReenviar?.status === 'Enviado'
                ? 'Atenção: Destinatário já recebeu esta mensagem'
                : 'Confirmar Reenvio de E-mail'}
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="px-6 py-2 overflow-y-auto min-h-0 flex-1">
            <AlertDialogDescription asChild>
              <div className="text-xs text-slate-600 space-y-2.5 pt-1 text-left">
                {envioParaReenviar?.status === 'Enviado' ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                      <span>Mensagem já entregue anteriormente</span>
                    </div>
                    <p className="leading-relaxed">
                      Este destinatário <strong>JÁ RECEBEU</strong> esta comunicação com sucesso em{' '}
                      <strong>
                        {envioParaReenviar.data_envio
                          ? new Date(envioParaReenviar.data_envio).toLocaleString('pt-BR')
                          : new Date(envioParaReenviar.created).toLocaleString('pt-BR')}
                      </strong>
                      .
                    </p>
                    <p className="leading-relaxed text-[11px] text-amber-800">
                      O reenvio criará uma <strong>nova tentativa real via servidor SMTP</strong> e
                      o contato receberá a mensagem novamente em sua caixa de entrada.
                    </p>
                  </div>
                ) : (
                  <span>
                    Você está prestes a realizar uma <strong>nova tentativa real de disparo</strong>{' '}
                    via servidor SMTP para o seguinte destinatário:
                  </span>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-slate-800">
                  <div>
                    <span className="font-semibold text-slate-500">Destinatário: </span>
                    <span className="font-medium break-words">
                      {envioParaReenviar?.nome_contato ||
                        envioParaReenviar?.expand?.contato?.nome ||
                        'Contato'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">E-mail: </span>
                    <span className="font-mono text-blue-700 font-medium break-all">
                      {envioParaReenviar?.email_utilizado}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Campanha: </span>
                    <span className="font-medium break-words">
                      {envioParaReenviar?.expand?.campanha?.nome || 'Campanha'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Assunto: </span>
                    <span className="font-medium italic break-words">
                      "{envioParaReenviar?.expand?.campanha?.assunto}"
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Status atual: </span>
                    <span className="font-medium">{envioParaReenviar?.status}</span>
                  </div>
                  {envioParaReenviar?.status === 'Erro' && envioParaReenviar?.mensagem_erro && (
                    <div className="pt-2">
                      <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-[11px] text-red-700 space-y-1">
                        <span className="font-semibold block text-red-800">
                          Diagnóstico do último erro:
                        </span>
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono leading-relaxed bg-white/70 p-2 rounded border border-red-100 max-h-40 overflow-y-auto">
                          {envioParaReenviar.mensagem_erro}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  O envio será processado individualmente e o status da linha será atualizado de
                  acordo com a resposta exata do servidor.
                </p>
              </div>
            </AlertDialogDescription>
          </div>

          <AlertDialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0 mt-0">
            <AlertDialogCancel disabled={!!reenviandoId} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmReenviar()
              }}
              disabled={!!reenviandoId}
              className={`text-white text-xs font-semibold ${
                envioParaReenviar?.status === 'Enviado'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {envioParaReenviar?.status === 'Enviado'
                ? 'Confirmar Reenvio Adicional'
                : 'Sim, Reenviar Agora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL SHADCN DE CONFIRMAÇÃO DE EXCLUSÃO DE ITEM COM FALHA (LIXEIRA) */}
      <AlertDialog
        open={!!envioParaExcluir}
        onOpenChange={(open) => !open && setEnvioParaExcluir(null)}
      >
        <AlertDialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mb-2">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-base text-slate-900">
              Excluir Registro de Falha do Histórico?
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="px-6 py-2 overflow-y-auto min-h-0 flex-1">
            <AlertDialogDescription asChild>
              <div className="text-xs text-slate-600 space-y-2.5 pt-1 text-left">
                <p className="text-red-700 font-medium">
                  Atenção: Esta ação é irreversível. O registro desta tentativa falha será
                  permanentemente removido da tabela de Histórico de Disparos.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-slate-800">
                  <div>
                    <span className="font-semibold text-slate-500">Destinatário: </span>
                    <span className="font-medium break-words">
                      {envioParaExcluir?.nome_contato ||
                        envioParaExcluir?.expand?.contato?.nome ||
                        'Contato'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">E-mail: </span>
                    <span className="font-mono text-blue-700 font-medium break-all">
                      {envioParaExcluir?.email_utilizado}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Campanha: </span>
                    <span className="font-medium break-words">
                      {envioParaExcluir?.expand?.campanha?.nome || 'Campanha'}
                    </span>
                  </div>
                  {envioParaExcluir?.mensagem_erro && (
                    <div className="pt-2">
                      <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-[11px] text-red-700 space-y-1">
                        <span className="font-semibold block text-red-800">Erro registrado:</span>
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono leading-relaxed bg-white/70 p-2 rounded border border-red-100 max-h-40 overflow-y-auto">
                          {envioParaExcluir.mensagem_erro}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  Uma entrada será automaticamente gravada no Log de Auditoria do sistema
                  identificando o usuário administrador responsável pela remoção deste item.
                </p>
              </div>
            </AlertDialogDescription>
          </div>

          <AlertDialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0 mt-0">
            <AlertDialogCancel disabled={!!excluindoId} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmExcluir()
              }}
              disabled={!!excluindoId}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {excluindoId ? 'Excluindo...' : 'Sim, Excluir Registro'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL SHADCN DE CONFIRMAÇÃO DE REENVIO EM LOTE */}
      <AlertDialog open={isLoteModalOpen} onOpenChange={setIsLoteModalOpen}>
        <AlertDialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
              <RotateCw className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-base text-slate-900">
              Reenviar Todos os Erros da Campanha?
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="px-6 py-2 overflow-y-auto min-h-0 flex-1">
            <AlertDialogDescription asChild>
              <div className="text-xs text-slate-600 space-y-2 pt-1 text-left">
                <span>
                  Esta ação reprocessará todos os envios que falharam para a campanha selecionada:
                </span>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-slate-800">
                  <div>
                    <span className="font-semibold text-slate-500">Campanha: </span>
                    <span className="font-medium break-words">
                      {campanhas.find((c) => c.id === filterCampanha)?.nome || 'Campanha'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Quantidade com Erro: </span>
                    <span className="font-bold text-red-600">
                      {
                        envios.filter((e) => e.campanha === filterCampanha && e.status === 'Erro')
                          .length
                      }{' '}
                      destinatário(s)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cada destinatário será contactado individualmente via servidor SMTP. O histórico
                  refletirá o resultado real de cada disparo.
                </p>
              </div>
            </AlertDialogDescription>
          </div>

          <AlertDialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0 mt-0">
            <AlertDialogCancel disabled={isReenviandoLote} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmReenviarLote()
              }}
              disabled={isReenviandoLote}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Sim, Reenviar Lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DETALHE DA COMUNICAÇÃO */}
      {selectedEnvio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detalhe do Envio Individual</h3>
                <span className="text-[11px] text-slate-400 font-mono">ID: {selectedEnvio.id}</span>
              </div>
              <button
                onClick={() => setSelectedEnvio(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Campanha
                  </span>
                  <span className="font-semibold text-slate-800 break-words">
                    {selectedEnvio.expand?.campanha?.nome || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Status
                  </span>
                  <div className="mt-0.5">{getStatusBadge(selectedEnvio.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Data de Envio
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedEnvio.data_envio
                      ? new Date(selectedEnvio.data_envio).toLocaleString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Destinatário
                  </span>
                  <span className="font-semibold text-slate-800 break-words">
                    {selectedEnvio.nome_contato || selectedEnvio.expand?.contato?.nome || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Revenda
                  </span>
                  <span className="font-semibold text-slate-800 break-words">
                    {selectedEnvio.nome_revenda || selectedEnvio.expand?.revenda?.nome || '—'}
                  </span>
                  {(selectedEnvio.codigo_revenda || selectedEnvio.expand?.revenda?.codigo) && (
                    <span className="block font-mono text-xs text-blue-700 font-semibold mt-0.5">
                      Código:{' '}
                      {selectedEnvio.codigo_revenda || selectedEnvio.expand?.revenda?.codigo}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    E-mail Utilizado
                  </span>
                  <span className="font-mono text-blue-700 break-all">
                    {selectedEnvio.email_utilizado || '—'}
                  </span>
                </div>
              </div>

              {selectedEnvio.erro && selectedEnvio.mensagem_erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                  <strong className="block font-semibold">Mensagem de Erro:</strong>
                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-[11px] bg-white/70 p-2.5 rounded-lg border border-red-100 max-h-48 overflow-y-auto leading-relaxed">
                    {selectedEnvio.mensagem_erro}
                  </div>
                </div>
              )}

              {selectedEnvio.mensagem_erro && selectedEnvio.mensagem_erro.includes('Simulado') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <strong className="block font-semibold">Modo de Envio:</strong>
                  Simulado — nenhum e-mail enviado de fato (as mensagens são registradas e auditadas
                  para testes, sem entrega na caixa postal real).
                </div>
              )}

              {/* Mensagem com placeholders resolvidos para este contato */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Mensagem Entregue / Renderizada
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-700">Assunto: </span>
                    <span className="text-slate-900 break-words">
                      {selectedEnvio.expand?.campanha?.assunto}
                    </span>
                  </div>
                  {/* Visualização da mensagem com cabeçalho oficial Roland DG */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="py-4 px-4 sm:px-6 border-b-2 border-[#005696] flex items-center justify-between bg-white">
                      <img
                        src={`${(import.meta as unknown as { env: { VITE_POCKETBASE_URL?: string } }).env.VITE_POCKETBASE_URL || ''}/backend/v1/roland-logo.png`}
                        alt="Roland DG Brasil"
                        className="w-[260px] sm:w-[340px] max-w-full h-auto object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                        Comunicação Oficial Roland DG Brasil
                      </span>
                    </div>

                    <div className="p-3 text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed font-sans max-h-60 overflow-y-auto">
                      {(selectedEnvio.expand?.campanha?.corpo || '')
                        .replace(
                          /{{nome}}/g,
                          selectedEnvio.nome_contato || selectedEnvio.expand?.contato?.nome || '',
                        )
                        .replace(
                          /{{revenda}}/g,
                          selectedEnvio.nome_revenda || selectedEnvio.expand?.revenda?.nome || '',
                        )}
                    </div>

                    {/* Bloco de Fechamento / Assinatura Oficial Roland DG */}
                    <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-600 font-sans leading-relaxed">
                      <div className="font-bold text-slate-800">Departamento Comercial</div>
                      <div className="font-bold text-slate-800 mt-1">
                        Roland DG Brasil Imp e Exp Ltda
                      </div>
                      <div>Rua San Jose, nº 780 - Pq Industrial San Jose</div>
                      <div>CEP 06715-862 - (11) 3500-2600 Opção 1</div>
                    </div>

                    {/* Linha Todos os direitos reservados + Aviso de Confidencialidade em Bloco Único (fonte menor 9.5-10px cinza) */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 font-sans">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">
                        Todos os direitos reservados
                      </div>
                      <div className="text-[9.5px] leading-relaxed text-slate-500 text-justify">
                        Esta mensagem (incluindo eventuais anexos) destina-se exclusivamente ao uso
                        de pessoas e entidades autorizadas pela Roland DG Brasil, estando protegida
                        pelo sigilo profissional e pela legislação aplicável. Caso você tenha
                        recebido este e-mail por engano, por favor, notifique o remetente e exclua
                        esta mensagem imediatamente. O uso não autorizado dessas informações é
                        proibido e está sujeito às penalidades aplicáveis. This message (including
                        attachments, if any) is for the exclusive use of persons and entities
                        authorized by Roland DG Brazil, protected by professional secrecy and by
                        law. If you have received this e-mail in error, please notify the sender and
                        delete this message immediately. Unauthorized use of such information is
                        prohibited and subject to applicable penalties.
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
                      Roland DG Brasil • Mensagem registrada e auditada.
                    </div>
                  </div>

                  {/* Detalhes dos Anexos no modal */}
                  <div className="border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700 text-xs block mb-1 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                      <span>
                        Anexos da Campanha ({selectedEnvio.expand?.campanha?.anexos?.length || 0}):
                      </span>
                    </span>
                    {selectedEnvio.expand?.campanha?.anexos &&
                    selectedEnvio.expand.campanha.anexos.length > 0 ? (
                      <div className="space-y-1">
                        {selectedEnvio.expand.campanha.anexos.map(
                          (filename: string, idx: number) => {
                            const fileUrl = `${(import.meta as unknown as { env: { VITE_POCKETBASE_URL?: string } }).env.VITE_POCKETBASE_URL || ''}/api/files/campanhas/${selectedEnvio.expand?.campanha?.id}/${filename}`
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-1.5 px-2 bg-white rounded border border-slate-200 text-xs"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                  <span
                                    className="truncate text-slate-700 font-medium"
                                    title={filename}
                                  >
                                    {filename}
                                  </span>
                                </div>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 ml-2"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Baixar</span>
                                </a>
                              </div>
                            )
                          },
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Nenhum anexo</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2">
                {/* Reenvio no modal de detalhes: disponível tanto para Erro quanto para Enviado */}
                {canWrite &&
                  (selectedEnvio.status === 'Erro' || selectedEnvio.status === 'Enviado') && (
                    <button
                      type="button"
                      onClick={() => {
                        const e = selectedEnvio
                        setEnvioParaReenviar(e)
                      }}
                      disabled={reenviandoId === selectedEnvio.id}
                      className={`px-4 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                        selectedEnvio.status === 'Enviado'
                          ? 'bg-sky-600 hover:bg-sky-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {reenviandoId === selectedEnvio.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {selectedEnvio.status === 'Enviado'
                          ? 'Reenviar Novamente'
                          : 'Reenviar Mensagem'}
                      </span>
                    </button>
                  )}

                {/* Lixeira no modal de detalhes: exclusiva para admin e apenas para Erro */}
                {isAdmin && selectedEnvio.status === 'Erro' && (
                  <button
                    type="button"
                    onClick={() => {
                      const e = selectedEnvio
                      setEnvioParaExcluir(e)
                    }}
                    disabled={excluindoId === selectedEnvio.id}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {excluindoId === selectedEnvio.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span>Excluir Falha</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedEnvio(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
