import React, { useState, useEffect, useMemo, useTransition } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Download,
  Filter,
  RotateCcw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  X,
  Store,
  Check,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { revendasService, auxiliaresService } from '@/services/apiService'
import { getCidadesPorUf } from '@/services/ibgeService'
import { exportToCSV } from '@/lib/exportCsv'
import type {
  Revenda,
  Segmento,
  Estado,
  InsideSales,
  Responsavel,
  CanalFaturamento,
  StatusRevenda,
} from '@/types'

export const RevendasScreen: React.FC = () => {
  const { canWrite } = useAuth()
  const [, startTransition] = useTransition()

  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Auxiliares para filtros e modal
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [insideSales, setInsideSales] = useState<InsideSales[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [canais, setCanais] = useState<CanalFaturamento[]>([])
  const [statusRevenda, setStatusRevenda] = useState<StatusRevenda[]>([])

  // Filtros
  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchNome, setSearchNome] = useState('')
  const [filterSegmento, setFilterSegmento] = useState('all')
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterCidade, setFilterCidade] = useState('')
  const [filterInside, setFilterInside] = useState('all')
  const [filterResponsavel, setFilterResponsavel] = useState('all')
  const [filterCanal, setFilterCanal] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Ordenação
  const [sortField, setSortField] = useState<'codigo' | 'nome' | 'cidade' | 'updated'>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(25)

  // Modal Nova/Editar Revenda
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRevenda, setEditingRevenda] = useState<Revenda | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [cidadesList, setCidadesList] = useState<string[]>([])
  const [isLoadingCidades, setIsLoadingCidades] = useState(false)

  // Estados inline para criar novos registros
  const [inlineMode, setInlineMode] = useState<
    'none' | 'segmento' | 'inside_sales' | 'responsavel' | 'canal_faturamento'
  >('none')
  const [inlineValue, setInlineValue] = useState('')
  const [isSavingInline, setIsSavingInline] = useState(false)

  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    segmento: '',
    status: '',
    inside_sales: '',
    responsavel: '',
    canal_faturamento: '',
    estado: '',
    cidade: '',
    observacoes: '',
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [rList, segs, ests, ins, resps, can, stats] = await Promise.all([
        revendasService.getAll(),
        auxiliaresService.getSegmentos(),
        auxiliaresService.getEstados(),
        auxiliaresService.getInsideSales(),
        auxiliaresService.getResponsaveis(),
        auxiliaresService.getCanaisFaturamento(),
        auxiliaresService.getStatusRevenda(),
      ])

      setRevendas(rList)
      setSegmentos(segs)
      setEstados(ests)
      setInsideSales(ins)
      setResponsaveis(resps)
      setCanais(can)
      setStatusRevenda(stats)
    } catch (err) {
      console.error('Erro ao carregar revendas:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem
  const filteredRevendas = useMemo(() => {
    return revendas.filter((r) => {
      if (
        searchCodigo &&
        (!r.codigo || !r.codigo.toLowerCase().includes(searchCodigo.trim().toLowerCase()))
      ) {
        return false
      }
      if (searchNome) {
        const qNome = searchNome.trim().toLowerCase()
        const matchesNome = r.nome?.toLowerCase().includes(qNome)
        const matchesCodigo = r.codigo?.toLowerCase().includes(qNome)
        if (!matchesNome && !matchesCodigo) return false
      }
      if (
        filterCidade &&
        (!r.cidade || !r.cidade.toLowerCase().includes(filterCidade.toLowerCase()))
      ) {
        return false
      }
      if (filterSegmento !== 'all' && r.segmento !== filterSegmento) return false
      if (filterEstado !== 'all' && r.estado !== filterEstado) return false
      if (filterInside !== 'all' && r.inside_sales !== filterInside) return false
      if (filterResponsavel !== 'all' && r.responsavel !== filterResponsavel) return false
      if (filterCanal !== 'all' && r.canal_faturamento !== filterCanal) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      return true
    })
  }, [
    revendas,
    searchCodigo,
    searchNome,
    filterCidade,
    filterSegmento,
    filterEstado,
    filterInside,
    filterResponsavel,
    filterCanal,
    filterStatus,
  ])

  // Ordenação
  const sortedRevendas = useMemo(() => {
    return [...filteredRevendas].sort((a, b) => {
      let valA = a[sortField] || ''
      let valB = b[sortField] || ''

      if (sortField === 'updated') {
        valA = a.updated || a.created
        valB = b.updated || b.created
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredRevendas, sortField, sortDir])

  // Paginação
  const totalPages = Math.ceil(sortedRevendas.length / perPage) || 1
  const paginatedRevendas = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return sortedRevendas.slice(start, start + perPage)
  }, [sortedRevendas, currentPage, perPage])

  const handleSort = (field: 'codigo' | 'nome' | 'cidade' | 'updated') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Carregar cidades quando o estado do form muda
  useEffect(() => {
    if (!formData.estado) {
      setCidadesList([])
      return
    }
    const est = estados.find((e) => e.id === formData.estado)
    if (!est) {
      setCidadesList([])
      return
    }

    let isMounted = true
    setIsLoadingCidades(true)
    getCidadesPorUf(est.uf)
      .then((cidades) => {
        if (!isMounted) return
        // Adicionar também a cidade atual caso não esteja na lista
        let finalCidades = [...cidades]
        if (formData.cidade && !finalCidades.includes(formData.cidade)) {
          finalCidades.unshift(formData.cidade)
        }
        setCidadesList(finalCidades)
      })
      .finally(() => {
        if (isMounted) setIsLoadingCidades(false)
      })

    return () => {
      isMounted = false
    }
  }, [formData.estado, estados])

  const handleOpenModal = (revenda?: Revenda) => {
    setInlineMode('none')
    setInlineValue('')
    if (revenda) {
      setEditingRevenda(revenda)
      setFormData({
        codigo: revenda.codigo || '',
        nome: revenda.nome || '',
        segmento: revenda.segmento || (segmentos[0]?.id ?? ''),
        status: revenda.status || (statusRevenda[0]?.id ?? ''),
        inside_sales: revenda.inside_sales || '',
        responsavel: revenda.responsavel || '',
        canal_faturamento: revenda.canal_faturamento || '',
        estado: revenda.estado || '',
        cidade: revenda.cidade || '',
        observacoes: revenda.observacoes || '',
      })
    } else {
      setEditingRevenda(null)
      setFormData({
        codigo: '',
        nome: '',
        segmento: segmentos[0]?.id || '',
        status: statusRevenda[0]?.id || '',
        inside_sales: '',
        responsavel: '',
        canal_faturamento: '',
        estado: '',
        cidade: '',
        observacoes: '',
      })
    }
    setIsModalOpen(true)
  }

  // Função inline para cadastrar novo valor e selecionar automaticamente
  const handleSaveInline = async (
    type: 'segmento' | 'inside_sales' | 'responsavel' | 'canal_faturamento',
  ) => {
    const val = inlineValue.trim()
    if (!val) {
      setInlineMode('none')
      return
    }

    setIsSavingInline(true)
    try {
      if (type === 'segmento') {
        const created = await auxiliaresService.createSegmento({ nome: val })
        setSegmentos((prev) => [...prev, created])
        setFormData((prev) => ({ ...prev, segmento: created.id }))
      } else if (type === 'inside_sales') {
        const created = await auxiliaresService.createInsideSales({ nome: val })
        setInsideSales((prev) => [...prev, created])
        setFormData((prev) => ({ ...prev, inside_sales: created.id }))
      } else if (type === 'responsavel') {
        const created = await auxiliaresService.createResponsavel({ nome: val })
        setResponsaveis((prev) => [...prev, created])
        setFormData((prev) => ({ ...prev, responsavel: created.id }))
      } else if (type === 'canal_faturamento') {
        const created = await auxiliaresService.createCanalFaturamento({ nome: val })
        setCanais((prev) => [...prev, created])
        setFormData((prev) => ({ ...prev, canal_faturamento: created.id }))
      }
      setInlineValue('')
      setInlineMode('none')
    } catch (err) {
      console.error('Erro ao cadastrar valor inline:', err)
      alert('Erro ao cadastrar novo valor. Tente novamente.')
    } finally {
      setIsSavingInline(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome.trim()) {
      alert('O nome da revenda é obrigatório.')
      return
    }
    if (!formData.segmento) {
      alert('Selecione um segmento.')
      return
    }
    if (!formData.status) {
      alert('Selecione um status.')
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<Revenda> = {
        codigo: formData.codigo.trim() || undefined,
        nome: formData.nome.trim(),
        segmento: formData.segmento,
        status: formData.status,
        inside_sales: formData.inside_sales || undefined,
        responsavel: formData.responsavel || undefined,
        canal_faturamento: formData.canal_faturamento || undefined,
        estado: formData.estado || undefined,
        cidade: formData.cidade.trim() || undefined,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingRevenda) {
        await revendasService.update(editingRevenda.id, payload)
      } else {
        await revendasService.create(payload)
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      console.error(err)
      alert('Erro ao salvar revenda. Verifique se o código já está em uso.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir a revenda "${nome}"? Todos os contatos vinculados serão removidos permanentemente.`,
      )
    ) {
      return
    }
    try {
      await revendasService.delete(id)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir revenda.')
    }
  }

  const handleExportCSV = () => {
    const dataToExport = sortedRevendas.map((r) => ({
      codigo: r.codigo || '',
      nome: r.nome || '',
      segmento: r.expand?.segmento?.nome || '',
      status: r.expand?.status?.nome || '',
      inside_sales: r.expand?.inside_sales?.nome || '',
      responsavel: r.expand?.responsavel?.nome || '',
      canal_faturamento: r.expand?.canal_faturamento?.nome || '',
      estado: r.expand?.estado?.uf || '',
      cidade: r.cidade || '',
      observacoes: r.observacoes || '',
    }))

    exportToCSV('revendas_export', dataToExport, [
      { key: 'codigo', label: 'Código' },
      { key: 'nome', label: 'Revenda' },
      { key: 'segmento', label: 'Segmento' },
      { key: 'status', label: 'Status' },
      { key: 'inside_sales', label: 'Inside Sales' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'canal_faturamento', label: 'Canal Faturamento' },
      { key: 'estado', label: 'UF' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'observacoes', label: 'Observações' },
    ])
  }

  const limparFiltros = () => {
    startTransition(() => {
      setSearchCodigo('')
      setSearchNome('')
      setFilterCidade('')
      setFilterSegmento('all')
      setFilterEstado('all')
      setFilterInside('all')
      setFilterResponsavel('all')
      setFilterCanal('all')
      setFilterStatus('all')
      setCurrentPage(1)
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestão de Revendas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulta, filtros, exportação e manutenção cadastral de canais
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
          {canWrite && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Revenda</span>
            </button>
          )}
        </div>
      </div>

      {/* CARD DE FILTROS COLAPSÁVEL */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Filtros de Pesquisa</span>
          </div>
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Busca Código */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchCodigo}
                onChange={(e) => {
                  setSearchCodigo(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Ex: C00099"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Busca Nome */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Nome / Razão
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchNome}
                onChange={(e) => {
                  setSearchNome(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Nome da revenda..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Segmento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Segmento</label>
            <select
              value={filterSegmento}
              onChange={(e) => {
                setFilterSegmento(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
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
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os estados</option>
              {estados.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.uf} - {est.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Cidade</label>
            <input
              type="text"
              value={filterCidade}
              onChange={(e) => {
                setFilterCidade(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filtrar por cidade..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Inside Sales */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Inside Sales
            </label>
            <select
              value={filterInside}
              onChange={(e) => {
                setFilterInside(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Inside Sales</option>
              {insideSales.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Responsável Comercial */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Responsável
            </label>
            <select
              value={filterResponsavel}
              onChange={(e) => {
                setFilterResponsavel(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os responsáveis</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Canal Faturamento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Canal Faturamento
            </label>
            <select
              value={filterCanal}
              onChange={(e) => {
                setFilterCanal(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os canais</option>
              {canais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os status</option>
              {statusRevenda.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE REVENDAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th
                  onClick={() => handleSort('codigo')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Código</span>
                    {sortField === 'codigo' ? (
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
                <th
                  onClick={() => handleSort('nome')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Revenda</span>
                    {sortField === 'nome' ? (
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
                <th className="py-3 px-4">Segmento</th>
                <th className="py-3 px-4">Inside Sales</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Canal Faturamento</th>
                <th className="py-3 px-4">UF</th>
                <th
                  onClick={() => handleSort('cidade')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Cidade</span>
                    {sortField === 'cidade' ? (
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
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando revendas...</span>
                  </td>
                </tr>
              ) : paginatedRevendas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Store className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>Nenhuma revenda encontrada para os critérios informados.</span>
                  </td>
                </tr>
              ) : (
                paginatedRevendas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                      {r.codigo ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-xs">
                          {r.codigo}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sem cód.</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <Link
                        to={`/revendas/${r.id}`}
                        className="hover:text-blue-600 inline-flex items-center gap-1.5"
                      >
                        <span>{r.nome}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.expand?.segmento?.nome || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.expand?.inside_sales?.nome || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.expand?.responsavel?.nome || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.expand?.canal_faturamento?.nome || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {r.expand?.estado?.uf || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.cidade || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {r.expand?.status?.nome || 'Ativa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/revendas/${r.id}`}
                          title="Visualizar e gerenciar contatos"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {canWrite && (
                          <>
                            <button
                              onClick={() => handleOpenModal(r)}
                              title="Editar revenda"
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.nome)}
                              title="Excluir revenda"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
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
              Exibindo {sortedRevendas.length === 0 ? 0 : (currentPage - 1) * perPage + 1} até{' '}
              {Math.min(currentPage * perPage, sortedRevendas.length)} de {sortedRevendas.length}{' '}
              revendas
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

      {/* MODAL: NOVA OU EDITAR REVENDA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRevenda ? 'Editar Revenda' : 'Cadastrar Nova Revenda'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código <span className="text-slate-400 font-normal">(ex: C00099)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="C00099"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Razão Social / Nome da Revenda *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome completo da revenda"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Segmento *</label>
                    {inlineMode !== 'segmento' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineMode('segmento')
                          setInlineValue('')
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo segmento</span>
                      </button>
                    ) : null}
                  </div>
                  {inlineMode === 'segmento' ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        placeholder="Nome do novo segmento..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingInline || !inlineValue.trim()}
                        onClick={() => handleSaveInline('segmento')}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        title="Salvar segmento"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineMode('none')}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.segmento}
                      onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Selecione um segmento</option>
                      {segmentos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status da Revenda *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Selecione o status</option>
                    {statusRevenda.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Inside Sales com cadastro inline */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Inside Sales</label>
                    {inlineMode !== 'inside_sales' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineMode('inside_sales')
                          setInlineValue('')
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo</span>
                      </button>
                    ) : null}
                  </div>
                  {inlineMode === 'inside_sales' ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        placeholder="Nome do consultor..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingInline || !inlineValue.trim()}
                        onClick={() => handleSaveInline('inside_sales')}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        title="Salvar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineMode('none')}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.inside_sales}
                      onChange={(e) => setFormData({ ...formData, inside_sales: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Nenhum / Selecione</option>
                      {insideSales.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Responsável Comercial com cadastro inline */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Responsável Comercial
                    </label>
                    {inlineMode !== 'responsavel' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineMode('responsavel')
                          setInlineValue('')
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo</span>
                      </button>
                    ) : null}
                  </div>
                  {inlineMode === 'responsavel' ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        placeholder="Nome do responsável..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingInline || !inlineValue.trim()}
                        onClick={() => handleSaveInline('responsavel')}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        title="Salvar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineMode('none')}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Nenhum / Selecione</option>
                      {responsaveis.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Canal Faturamento com cadastro inline */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Canal Faturamento
                    </label>
                    {inlineMode !== 'canal_faturamento' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineMode('canal_faturamento')
                          setInlineValue('')
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo</span>
                      </button>
                    ) : null}
                  </div>
                  {inlineMode === 'canal_faturamento' ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        placeholder="Nome do canal..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingInline || !inlineValue.trim()}
                        onClick={() => handleSaveInline('canal_faturamento')}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        title="Salvar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineMode('none')}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.canal_faturamento}
                      onChange={(e) =>
                        setFormData({ ...formData, canal_faturamento: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Nenhum / Selecione</option>
                      {canais.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Estado e Cidade Sanitizados com IBGE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado (UF) *
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => {
                      setFormData({ ...formData, estado: e.target.value, cidade: '' })
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Selecione o estado</option>
                    {estados.map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.uf} - {est.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Cidade {isLoadingCidades ? '(carregando IBGE...)' : ''}
                    </label>
                    {formData.estado && (
                      <span className="text-[10px] text-slate-400">
                        {cidadesList.length} cidades disponíveis
                      </span>
                    )}
                  </div>
                  {formData.estado ? (
                    <select
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      disabled={isLoadingCidades}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white disabled:bg-slate-50"
                    >
                      <option value="">Selecione a cidade...</option>
                      {cidadesList.map((cid) => (
                        <option key={cid} value={cid}>
                          {cid}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 text-xs border border-slate-200 bg-slate-50 text-slate-400 rounded-lg italic">
                      Selecione o estado primeiro para listar as cidades
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Gerais
                </label>
                <textarea
                  rows={2}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre o canal..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Revenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
