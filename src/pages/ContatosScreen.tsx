import React, { useState, useEffect, useMemo, useTransition } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users,
  Plus,
  Download,
  Filter,
  RotateCcw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Star,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { contatosService, revendasService, auxiliaresService } from '@/services/apiService'
import { exportToCSV } from '@/lib/exportCsv'
import type { Contato, Revenda, Cargo } from '@/types'

export const ContatosScreen: React.FC = () => {
  const { canWrite } = useAuth()
  const [, startTransition] = useTransition()
  const [searchParams] = useSearchParams()

  const [contatos, setContatos] = useState<Contato[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchGeral, setSearchGeral] = useState(searchParams.get('search') || '')
  const [filterRevenda, setFilterRevenda] = useState('all')
  const [filterCargo, setFilterCargo] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPrincipal, setFilterPrincipal] = useState('all')
  const [filterComunicacoes, setFilterComunicacoes] = useState('all')

  // Ordenação
  const [sortField, setSortField] = useState<'nome' | 'email' | 'revenda' | 'updated'>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  // Modal Novo/Editar Contato
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<Contato | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    revenda: '',
    nome: '',
    cargo: '',
    email: '',
    email_secundario: '',
    telefone: '',
    celular: '',
    whatsapp: '',
    estado_regiao: '',
    contato_principal: false,
    recebe_comunicacoes: true,
    status_contato: 'Ativo' as 'Ativo' | 'Inativo',
    observacoes: '',
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [cList, rList, cgList] = await Promise.all([
        contatosService.getAll(),
        revendasService.getAll(),
        auxiliaresService.getCargos(),
      ])

      setContatos(cList)
      setRevendas(rList)
      setCargos(cgList)
    } catch (err) {
      console.error('Erro ao carregar contatos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem
  const filteredContatos = useMemo(() => {
    const q = searchGeral.toLowerCase().trim()
    return contatos.filter((c) => {
      if (q) {
        const matchesNome = c.nome.toLowerCase().includes(q)
        const matchesEmail =
          c.email?.toLowerCase().includes(q) || c.email_secundario?.toLowerCase().includes(q)
        const matchesTel =
          c.telefone?.includes(q) || c.celular?.includes(q) || c.whatsapp?.includes(q)
        const matchesRev = c.expand?.revenda?.nome?.toLowerCase().includes(q) || false
        const matchesRevCodigo = c.expand?.revenda?.codigo?.toLowerCase().includes(q) || false
        if (!matchesNome && !matchesEmail && !matchesTel && !matchesRev && !matchesRevCodigo)
          return false
      }
      if (filterRevenda !== 'all' && c.revenda !== filterRevenda) return false
      if (filterCargo !== 'all' && c.cargo !== filterCargo) return false
      if (filterStatus !== 'all' && c.status_contato !== filterStatus) return false
      if (filterPrincipal === 'sim' && !c.contato_principal) return false
      if (filterPrincipal === 'nao' && c.contato_principal) return false
      if (filterComunicacoes === 'sim' && c.recebe_comunicacoes === false) return false
      if (filterComunicacoes === 'nao' && c.recebe_comunicacoes !== false) return false
      return true
    })
  }, [
    contatos,
    searchGeral,
    filterRevenda,
    filterCargo,
    filterStatus,
    filterPrincipal,
    filterComunicacoes,
  ])

  // Ordenação
  const sortedContatos = useMemo(() => {
    return [...filteredContatos].sort((a, b) => {
      let valA = ''
      let valB = ''

      if (sortField === 'nome') {
        valA = a.nome
        valB = b.nome
      } else if (sortField === 'email') {
        valA = a.email || ''
        valB = b.email || ''
      } else if (sortField === 'revenda') {
        valA = a.expand?.revenda?.nome || ''
        valB = b.expand?.revenda?.nome || ''
      } else if (sortField === 'updated') {
        valA = a.updated || a.created
        valB = b.updated || b.created
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredContatos, sortField, sortDir])

  // Paginação
  const totalPages = Math.ceil(sortedContatos.length / perPage) || 1
  const paginatedContatos = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return sortedContatos.slice(start, start + perPage)
  }, [sortedContatos, currentPage, perPage])

  const handleSort = (field: 'nome' | 'email' | 'revenda' | 'updated') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleOpenModal = (contato?: Contato) => {
    if (contato) {
      setEditingContato(contato)
      setFormData({
        revenda: contato.revenda || (revendas[0]?.id ?? ''),
        nome: contato.nome || '',
        cargo: contato.cargo || '',
        email: contato.email || '',
        email_secundario: contato.email_secundario || '',
        telefone: contato.telefone || '',
        celular: contato.celular || '',
        whatsapp: contato.whatsapp || '',
        estado_regiao: contato.estado_regiao || '',
        contato_principal: !!contato.contato_principal,
        recebe_comunicacoes: contato.recebe_comunicacoes !== false,
        status_contato: contato.status_contato || 'Ativo',
        observacoes: contato.observacoes || '',
      })
    } else {
      setEditingContato(null)
      setFormData({
        revenda: revendas[0]?.id || '',
        nome: '',
        cargo: cargos[0]?.id || '',
        email: '',
        email_secundario: '',
        telefone: '',
        celular: '',
        whatsapp: '',
        estado_regiao: '',
        contato_principal: false,
        recebe_comunicacoes: true,
        status_contato: 'Ativo',
        observacoes: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome.trim()) {
      alert('O nome do contato é obrigatório.')
      return
    }
    if (!formData.revenda) {
      alert('Vincule o contato a uma revenda.')
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<Contato> = {
        revenda: formData.revenda,
        nome: formData.nome.trim(),
        cargo: formData.cargo || undefined,
        email: formData.email.trim() || undefined,
        email_secundario: formData.email_secundario.trim() || undefined,
        telefone: formData.telefone.trim() || undefined,
        celular: formData.celular.trim() || undefined,
        whatsapp: formData.whatsapp.trim() || undefined,
        estado_regiao: formData.estado_regiao.trim() || undefined,
        contato_principal: formData.contato_principal,
        recebe_comunicacoes: formData.recebe_comunicacoes,
        status_contato: formData.status_contato,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingContato) {
        await contatosService.update(editingContato.id, payload)
      } else {
        await contatosService.create(payload)
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar contato. Verifique o formato dos campos.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o contato "${nome}"?`)) return
    try {
      await contatosService.delete(id)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir contato.')
    }
  }

  const handleTogglePrincipal = async (c: Contato) => {
    if (!canWrite) return
    try {
      await contatosService.update(c.id, { contato_principal: !c.contato_principal })
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleComunicacoes = async (c: Contato) => {
    if (!canWrite) return
    try {
      await contatosService.update(c.id, { recebe_comunicacoes: !c.recebe_comunicacoes })
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExportCSV = () => {
    const dataToExport = sortedContatos.map((c) => ({
      nome: c.nome,
      revenda: c.expand?.revenda?.nome || '',
      codigo_revenda: c.expand?.revenda?.codigo || '',
      cargo: c.expand?.cargo?.nome || '',
      email: c.email || '',
      email_secundario: c.email_secundario || '',
      telefone: c.telefone || '',
      celular: c.celular || '',
      whatsapp: c.whatsapp || '',
      contato_principal: c.contato_principal ? 'Sim' : 'Não',
      recebe_comunicacoes: c.recebe_comunicacoes !== false ? 'Sim' : 'Não',
      status: c.status_contato || 'Ativo',
    }))

    exportToCSV('contatos_export', dataToExport, [
      { key: 'nome', label: 'Nome' },
      { key: 'revenda', label: 'Revenda' },
      { key: 'codigo_revenda', label: 'Código Revenda' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'email', label: 'E-mail Principal' },
      { key: 'email_secundario', label: 'E-mail Secundário' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'celular', label: 'Celular' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'contato_principal', label: 'Contato Principal' },
      { key: 'recebe_comunicacoes', label: 'Recebe Comunicações' },
      { key: 'status', label: 'Status' },
    ])
  }

  const limparFiltros = () => {
    startTransition(() => {
      setSearchGeral('')
      setFilterRevenda('all')
      setFilterCargo('all')
      setFilterStatus('all')
      setFilterPrincipal('all')
      setFilterComunicacoes('all')
      setCurrentPage(1)
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Cadastro Central de Contatos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão completa de pessoas, cargos e canais diretos de toda a rede de revendas
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
              <span>Novo Contato</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Filtros de Contatos</span>
          </div>
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Busca Geral */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Busca Textual
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
                placeholder="Nome, e-mail, tel, revenda ou cód. revenda..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Revenda */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revenda</label>
            <select
              value={filterRevenda}
              onChange={(e) => {
                setFilterRevenda(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todas as revendas</option>
              {revendas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.codigo ? `[${r.codigo}] ` : ''}
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Cargo</label>
            <select
              value={filterCargo}
              onChange={(e) => {
                setFilterCargo(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os cargos</option>
              {cargos.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Principal */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Contato Principal?
            </label>
            <select
              value={filterPrincipal}
              onChange={(e) => {
                setFilterPrincipal(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="sim">Sim (Apenas Principais)</option>
              <option value="nao">Não (Secundários)</option>
            </select>
          </div>

          {/* Recebe E-mails */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Recebe Comunicações?
            </label>
            <select
              value={filterComunicacoes}
              onChange={(e) => {
                setFilterComunicacoes(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="sim">Sim (Opt-in)</option>
              <option value="nao">Não (Bloqueados)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE CONTATOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-10 text-center">Princ.</th>
                <th
                  onClick={() => handleSort('nome')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Nome</span>
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
                <th
                  onClick={() => handleSort('revenda')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
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
                <th className="py-3 px-4">Cargo</th>
                <th
                  onClick={() => handleSort('email')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>E-mail</span>
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
                <th className="py-3 px-4">Telefones</th>
                <th className="py-3 px-4 text-center">E-mails</th>
                <th className="py-3 px-4">Status</th>
                {canWrite && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando base de contatos...</span>
                  </td>
                </tr>
              ) : paginatedContatos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>Nenhum contato encontrado.</span>
                  </td>
                </tr>
              ) : (
                paginatedContatos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Estrela contato principal */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePrincipal(c)}
                        disabled={!canWrite}
                        title={c.contato_principal ? 'Contato Principal' : 'Marcar como Principal'}
                        className={`p-1 rounded transition-colors ${
                          c.contato_principal
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-slate-400'
                        }`}
                      >
                        <Star
                          className={`h-4 w-4 ${c.contato_principal ? 'fill-amber-400' : ''}`}
                        />
                      </button>
                    </td>

                    {/* Nome */}
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {c.nome}
                    </td>

                    {/* Revenda */}
                    <td className="py-3 px-4">
                      {c.expand?.revenda ? (
                        <div>
                          <Link
                            to={`/revendas/${c.expand.revenda.id}`}
                            className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{c.expand.revenda.nome}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {c.expand.revenda.codigo && (
                            <div className="mt-0.5">
                              <span className="font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                Cód: {c.expand.revenda.codigo}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Cargo */}
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {c.expand?.cargo?.nome || '—'}
                      </span>
                    </td>

                    {/* E-mail */}
                    <td className="py-3 px-4">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-blue-700 hover:underline font-medium"
                        >
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Sem e-mail</span>
                      )}
                      {c.email_secundario && (
                        <span className="block text-[11px] text-slate-400">
                          {c.email_secundario}
                        </span>
                      )}
                    </td>

                    {/* Telefones */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {c.telefone || c.celular || c.whatsapp || '—'}
                    </td>

                    {/* Recebe E-mails */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleComunicacoes(c)}
                        disabled={!canWrite}
                        title={
                          c.recebe_comunicacoes !== false ? 'Recebe comunicações' : 'Não recebe'
                        }
                        className="inline-flex items-center justify-center text-blue-600"
                      >
                        {c.recebe_comunicacoes !== false ? (
                          <ToggleRight className="h-6 w-6 text-blue-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          c.status_contato === 'Inativo'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {c.status_contato || 'Ativo'}
                      </span>
                    </td>

                    {/* Ações */}
                    {canWrite && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenModal(c)}
                            title="Editar contato"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.nome)}
                            title="Excluir contato"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
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
              Exibindo {sortedContatos.length === 0 ? 0 : (currentPage - 1) * perPage + 1} até{' '}
              {Math.min(currentPage * perPage, sortedContatos.length)} de {sortedContatos.length}{' '}
              contatos
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

      {/* MODAL NOVO / EDITAR CONTATO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingContato ? 'Editar Contato' : 'Novo Contato'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revenda Vinculada *
                </label>
                <select
                  required
                  value={formData.revenda}
                  onChange={(e) => setFormData({ ...formData, revenda: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Selecione a revenda...</option>
                  {revendas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codigo ? `[${r.codigo}] ` : ''}
                      {r.nome}
                    </option>
                  ))}
                </select>{' '}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do contato..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo</label>
                  <select
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Selecione um cargo</option>
                    {cargos.map((cg) => (
                      <option key={cg.id} value={cg.id}>
                        {cg.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status do Contato
                  </label>
                  <select
                    value={formData.status_contato}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status_contato: e.target.value as 'Ativo' | 'Inativo',
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail Principal
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com.br"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail Secundário
                  </label>
                  <input
                    type="email"
                    value={formData.email_secundario}
                    onChange={(e) => setFormData({ ...formData, email_secundario: e.target.value })}
                    placeholder="outro.email@empresa.com.br"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone Fixo
                  </label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 3333-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Celular</label>
                  <input
                    type="text"
                    value={formData.celular}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.contato_principal}
                    onChange={(e) =>
                      setFormData({ ...formData, contato_principal: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Contato Principal</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.recebe_comunicacoes}
                    onChange={(e) =>
                      setFormData({ ...formData, recebe_comunicacoes: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Recebe Comunicações</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais..."
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
                  {isSaving ? 'Salvando...' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
