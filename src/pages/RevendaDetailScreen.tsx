import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Store,
  Users,
  Plus,
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
  Check,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { revendasService, contatosService, auxiliaresService } from '@/services/apiService'
import type { Revenda, Contato, Cargo } from '@/types'

export const RevendaDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canWrite } = useAuth()

  const [revenda, setRevenda] = useState<Revenda | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal Novo / Editar Contato
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<Contato | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [inlineCargoMode, setInlineCargoMode] = useState(false)
  const [inlineCargoValue, setInlineCargoValue] = useState('')
  const [isSavingCargo, setIsSavingCargo] = useState(false)
  const [formData, setFormData] = useState({
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
    if (!id) return
    setIsLoading(true)
    try {
      const [rData, cList, cgList] = await Promise.all([
        revendasService.getById(id),
        contatosService.getByRevenda(id),
        auxiliaresService.getCargos(),
      ])

      setRevenda(rData)
      setContatos(cList)
      setCargos(cgList)
    } catch (err) {
      console.error('Erro ao carregar detalhes da revenda:', err)
      alert('Revenda não encontrada ou erro de conexão.')
      navigate('/revendas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleOpenContatoModal = (contato?: Contato) => {
    setInlineCargoMode(false)
    setInlineCargoValue('')
    if (contato) {
      setEditingContato(contato)
      setFormData({
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
        nome: '',
        cargo: cargos[0]?.id || '',
        email: '',
        email_secundario: '',
        telefone: '',
        celular: '',
        whatsapp: '',
        estado_regiao: revenda?.expand?.estado?.nome || '',
        contato_principal: contatos.length === 0,
        recebe_comunicacoes: true,
        status_contato: 'Ativo',
        observacoes: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSaveInlineCargo = async () => {
    const val = inlineCargoValue.trim()
    if (!val) {
      setInlineCargoMode(false)
      return
    }
    setIsSavingCargo(true)
    try {
      const created = await auxiliaresService.createCargo({ nome: val })
      setCargos((prev) => [...prev, created])
      setFormData((prev) => ({ ...prev, cargo: created.id }))
      setInlineCargoValue('')
      setInlineCargoMode(false)
    } catch (err) {
      console.error('Erro ao cadastrar cargo inline:', err)
      alert('Erro ao cadastrar novo cargo.')
    } finally {
      setIsSavingCargo(false)
    }
  }

  const handleSaveContato = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!formData.nome.trim()) {
      alert('O nome do contato é obrigatório.')
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<Contato> = {
        revenda: id,
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
      alert('Erro ao salvar contato. Verifique o formato do e-mail.')
    } finally {
      setIsSaving(false)
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

  const handleDeleteContato = async (contatoId: string, nome: string) => {
    if (!confirm(`Deseja realmente remover o contato "${nome}"?`)) return
    try {
      await contatosService.delete(contatoId)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir contato.')
    }
  }

  if (isLoading || !revenda) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* NAVEGAÇÃO DE VOLTA */}
      <div className="flex items-center justify-between">
        <Link
          to="/revendas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Revendas</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">ID: {revenda.id}</span>
      </div>

      {/* HEADER DA REVENDA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Store className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{revenda.nome}</h1>
              {revenda.codigo ? (
                <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                  Código da Revenda: {revenda.codigo}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 italic">
                  Sem código cadastrado
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {revenda.expand?.status?.nome || 'Ativa'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {revenda.expand?.segmento?.nome || 'Segmento não informado'} •{' '}
              {revenda.expand?.estado?.nome
                ? `${revenda.expand.estado.nome} (${revenda.expand.estado.uf})`
                : 'Brasil'}
              {revenda.cidade ? ` • ${revenda.cidade}` : ''}
            </p>
          </div>
        </div>

        {/* ATRIBUTOS COMERCIAIS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Inside Sales
            </span>
            <span className="font-semibold text-slate-800">
              {revenda.expand?.inside_sales?.nome || '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Responsável
            </span>
            <span className="font-semibold text-slate-800">
              {revenda.expand?.responsavel?.nome || '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Faturamento
            </span>
            <span className="font-semibold text-slate-800">
              {revenda.expand?.canal_faturamento?.nome || '—'}
            </span>
          </div>
        </div>
      </div>

      {revenda.observacoes && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
          <strong className="text-amber-800 font-semibold block mb-0.5">
            Observações da Revenda:
          </strong>
          {revenda.observacoes}
        </div>
      )}

      {/* SEÇÃO DE CONTATOS RELACIONADOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Contatos da Revenda ({contatos.length})
              </h2>
              <p className="text-xs text-slate-400">
                Pessoas, cargos, canais diretos e preferências de comunicação
              </p>
            </div>
          </div>
          {canWrite && (
            <button
              onClick={() => handleOpenContatoModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar Contato</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-10 text-center">Princ.</th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Cargo</th>
                <th className="py-3 px-4">E-mail Principal</th>
                <th className="py-3 px-4">Telefones</th>
                <th className="py-3 px-4 text-center">Recebe E-mails</th>
                <th className="py-3 px-4">Status</th>
                {canWrite && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {contatos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Nenhum contato cadastrado nesta revenda. Clique em "Adicionar Contato" para
                    incluir.
                  </td>
                </tr>
              ) : (
                contatos.map((c) => (
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
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>
                        <span>{c.nome}</span>
                        {c.observacoes && (
                          <span className="block text-[11px] text-slate-400 font-normal truncate max-w-xs">
                            {c.observacoes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {c.expand?.cargo?.nome || '—'}
                      </span>
                    </td>

                    {/* E-mails */}
                    <td className="py-3 px-4">
                      {c.email ? (
                        <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <a href={`mailto:${c.email}`} className="hover:underline">
                            {c.email}
                          </a>
                        </div>
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
                      {c.telefone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{c.telefone}</span>
                        </div>
                      )}
                      {c.celular && (
                        <div className="text-[11px] text-slate-500">Cel: {c.celular}</div>
                      )}
                      {c.whatsapp && (
                        <div className="text-[11px] text-emerald-600">Whats: {c.whatsapp}</div>
                      )}
                      {!c.telefone && !c.celular && !c.whatsapp && '—'}
                    </td>

                    {/* Toggle Recebe Comunicações */}
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
                            onClick={() => handleOpenContatoModal(c)}
                            title="Editar contato"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteContato(c.id, c.nome)}
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
      </div>

      {/* MODAL NOVO / EDITAR CONTATO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingContato ? 'Editar Contato' : 'Adicionar Contato na Revenda'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContato} className="p-6 space-y-4">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Cargo</label>
                    {!inlineCargoMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineCargoMode(true)
                          setInlineCargoValue('')
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo cargo</span>
                      </button>
                    ) : null}
                  </div>
                  {inlineCargoMode ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        autoFocus
                        value={inlineCargoValue}
                        onChange={(e) => setInlineCargoValue(e.target.value)}
                        placeholder="Nome do novo cargo..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingCargo || !inlineCargoValue.trim()}
                        onClick={handleSaveInlineCargo}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        title="Salvar cargo"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineCargoMode(false)}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
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
                  )}
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
                  <span>Contato Principal desta Revenda</span>
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
                  <span>Recebe Comunicações por E-mail</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações do Contato
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
