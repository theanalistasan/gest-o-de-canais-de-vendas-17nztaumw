import React, { useState, useEffect, useMemo, useTransition } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { comunicacoesService } from '@/services/apiService'
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
import type { Envio, Campanha } from '@/types'

export const HistoricoScreen: React.FC = () => {
  const { toast } = useToast()
  const { canWrite, isAdmin } = useAuth()
  const [, startTransition] = useTransition()
  const [searchParams] = useSearchParams()

  const [envios, setEnvios] = useState<Envio[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
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
      const [eList, cList] = await Promise.all([
        comunicacoesService.getAllEnvios(),
        comunicacoesService.listCampanhas(),
      ])

      setEnvios(eList)
      setCampanhas(cList)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
        const matchCodigo = e.expand?.revenda?.codigo?.toLowerCase().includes(q)
        const matchRevenda = e.expand?.revenda?.nome?.toLowerCase().includes(q)
        const matchContato = e.expand?.contato?.nome?.toLowerCase().includes(q)
        const matchEmail = e.email_utilizado?.toLowerCase().includes(q)
        const matchCampanha = e.expand?.campanha?.nome?.toLowerCase().includes(q)
        if (!matchCodigo && !matchRevenda && !matchContato && !matchEmail && !matchCampanha) {
          return false
        }
      }
      return true
    })
  }, [envios, filterCampanha, filterStatus, filterDataInicio, filterDataFim, searchGeral])

  // Paginação
  const totalPages = Math.ceil(filteredEnvios.length / perPage) || 1
  const paginatedEnvios = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return filteredEnvios.slice(start, start + perPage)
  }, [filteredEnvios, currentPage, perPage])

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
      const pb = (await import('@/lib/pocketbase/client')).default
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

      const pb = (await import('@/lib/pocketbase/client')).default
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
    const dataToExport = filteredEnvios.map((e) => ({
      campanha: e.expand?.campanha?.nome || '',
      assunto: e.expand?.campanha?.assunto || '',
      data_envio: e.data_envio
        ? new Date(e.data_envio).toLocaleString('pt-BR')
        : new Date(e.created).toLocaleString('pt-BR'),
      usuario:
        e.expand?.campanha?.expand?.usuario?.name ||
        e.expand?.campanha?.expand?.usuario?.email ||
        '',
      revenda: e.expand?.revenda?.nome || '',
      codigo_revenda: e.expand?.revenda?.codigo || '',
      contato: e.expand?.contato?.nome || '',
      email: e.email_utilizado || '',
      status: e.status,
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
      { key: 'contato', label: 'Contato' },
      { key: 'email', label: 'E-mail Utilizado' },
      { key: 'status', label: 'Status' },
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

      {/* TABELA DE ENVIOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Campanha / Assunto</th>
                <th className="py-3 px-4">Data/Hora</th>
                <th className="py-3 px-4">Cód. Revenda</th>
                <th className="py-3 px-4">Revenda</th>
                <th className="py-3 px-4">Contato</th>
                <th className="py-3 px-4">E-mail Utilizado</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Diagnóstico</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando histórico de envios...</span>
                  </td>
                </tr>
              ) : paginatedEnvios.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>Nenhum envio registrado no histórico.</span>
                  </td>
                </tr>
              ) : (
                paginatedEnvios.map((env) => (
                  <tr key={env.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Campanha */}
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-900 block truncate">
                        {env.expand?.campanha?.nome || 'Campanha'}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate block">
                        {env.expand?.campanha?.assunto || '—'}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {env.data_envio
                        ? new Date(env.data_envio).toLocaleString('pt-BR')
                        : new Date(env.created).toLocaleString('pt-BR')}
                    </td>

                    {/* Código Revenda */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {env.expand?.revenda?.codigo ? (
                        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {env.expand.revenda.codigo}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Revenda */}
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {env.expand?.revenda?.nome || '—'}
                    </td>

                    {/* Contato */}
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {env.expand?.contato?.nome || '—'}
                    </td>

                    {/* E-mail */}
                    <td className="py-3 px-4 font-mono text-blue-700">
                      {env.email_utilizado || '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(env.status)}</td>

                    {/* Diagnóstico */}
                    <td className="py-3 px-4 max-w-[200px]">
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
                          Registro auditado com sucesso
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Aguardando processamento</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ação de reenvio: disponível tanto para status 'Erro' quanto 'Enviado' */}
                        {canWrite && (env.status === 'Erro' || env.status === 'Enviado') && (
                          <button
                            type="button"
                            onClick={() => setEnvioParaReenviar(env)}
                            disabled={
                              reenviandoId === env.id || isReenviandoLote || excluindoId === env.id
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

                        {/* Ação de lixeira: exclusiva para perfil Administrador e apenas para status 'Erro' */}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Exibindo {filteredEnvios.length === 0 ? 0 : (currentPage - 1) * perPage + 1} até{' '}
              {Math.min(currentPage * perPage, filteredEnvios.length)} de {filteredEnvios.length}{' '}
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
          </div>

          <div className="flex items-center gap-1.5">
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
                      {envioParaReenviar?.expand?.contato?.nome || 'Contato'}
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
                      {envioParaExcluir?.expand?.contato?.nome || 'Contato'}
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
                    {selectedEnvio.expand?.contato?.nome || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Revenda
                  </span>
                  <span className="font-semibold text-slate-800 break-words">
                    {selectedEnvio.expand?.revenda?.nome || '—'}
                  </span>
                  {selectedEnvio.expand?.revenda?.codigo && (
                    <span className="block font-mono text-xs text-blue-700 font-semibold mt-0.5">
                      Código: {selectedEnvio.expand.revenda.codigo}
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
                  <div className="border-t border-slate-200 pt-2 text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed font-sans bg-white p-3 rounded-lg border max-h-60 overflow-y-auto">
                    {(selectedEnvio.expand?.campanha?.corpo || '')
                      .replace(/{{nome}}/g, selectedEnvio.expand?.contato?.nome || '')
                      .replace(/{{revenda}}/g, selectedEnvio.expand?.revenda?.nome || '')}
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
