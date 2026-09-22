import React, { useState, useEffect } from 'react'
import {
  Users,
  Database,
  UploadCloud,
  Mail,
  MailCheck,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  RotateCcw,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { adminService, auxiliaresService } from '@/services/apiService'
import { toast } from 'sonner'
import { ImportWizard } from '@/components/admin/ImportWizard'
import type {
  User,
  Auditoria,
  Remetente,
  Segmento,
  Cargo,
  Estado,
  InsideSales,
  Responsavel,
  CanalFaturamento,
  StatusRevenda,
} from '@/types'

export const AdministracaoScreen: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = (() => {
    const tabParam = searchParams.get('tab')
    if (
      tabParam === 'usuarios' ||
      tabParam === 'remetentes' ||
      tabParam === 'auxiliares' ||
      tabParam === 'importacao' ||
      tabParam === 'email' ||
      tabParam === 'auditoria'
    ) {
      return tabParam
    }
    return 'usuarios'
  })()

  // Abas: 'usuarios' | 'remetentes' | 'auxiliares' | 'importacao' | 'email' | 'auditoria'
  const [activeTab, setActiveTab] = useState<
    'usuarios' | 'remetentes' | 'auxiliares' | 'importacao' | 'email' | 'auditoria'
  >(initialTab)

  // Sincronizar tab com query param
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (
      tabParam &&
      tabParam !== activeTab &&
      ['usuarios', 'remetentes', 'auxiliares', 'importacao', 'email', 'auditoria'].includes(
        tabParam,
      )
    ) {
      setActiveTab(tabParam as any)
    }
  }, [searchParams])

  const handleSelectTab = (
    tab: 'usuarios' | 'remetentes' | 'auxiliares' | 'importacao' | 'email' | 'auditoria',
  ) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // ABA 1: USUÁRIOS
  const [usersList, setUsersList] = useState<User[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'consulta' as 'admin' | 'gestor' | 'consulta',
    password: '',
  })

  // ABA 2: TABELAS AUXILIARES
  const [auxSubTab, setAuxSubTab] = useState<
    | 'segmentos'
    | 'cargos'
    | 'estados'
    | 'inside_sales'
    | 'responsaveis'
    | 'canais_faturamento'
    | 'status_revenda'
  >('segmentos')
  const [auxItems, setAuxItems] = useState<
    Array<{ id: string; nome: string; uf?: string; cor?: string }>
  >([])
  const [isAuxLoading, setIsAuxLoading] = useState(false)
  const [newAuxName, setNewAuxName] = useState('')
  const [newAuxUf, setNewAuxUf] = useState('')
  const [newAuxCor, setNewAuxCor] = useState('#2563EB')

  // ABA 4: CONFIGURAÇÕES DE E-MAIL
  const [remetentes, setRemetentes] = useState<Remetente[]>([])
  const [editingRemetente, setEditingRemetente] = useState<Remetente | null>(null)
  const [remetenteModalOpen, setRemetenteModalOpen] = useState(false)
  const [remetenteFormData, setRemetenteFormData] = useState({ nome: '', email: '' })
  const [emailConfig, setEmailConfig] = useState<{
    mode: 'real' | 'simulado'
    configured: boolean
    host: string
    port: string
    user: string
    defaultSender: string
    hasPassword: boolean
    message: string
  } | null>(null)
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [newRemetenteNome, setNewRemetenteNome] = useState('')
  const [newRemetenteEmail, setNewRemetenteEmail] = useState('')

  // ABA 5: AUDITORIA
  const [auditorias, setAuditorias] = useState<Auditoria[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const [auditFilterAcao, setAuditFilterAcao] = useState('all')
  const [selectedAudit, setSelectedAudit] = useState<Auditoria | null>(null)

  // Carregar dados de acordo com a aba
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers()
    } else if (activeTab === 'remetentes') {
      loadRemetentes()
    } else if (activeTab === 'auxiliares') {
      loadAuxItems()
    } else if (activeTab === 'email') {
      loadRemetentes()
      loadEmailConfig()
    } else if (activeTab === 'auditoria') {
      loadAuditorias()
    }
  }, [activeTab, auxSubTab])

  // ---------- USUÁRIOS ----------
  const loadUsers = async () => {
    setIsUsersLoading(true)
    try {
      const list = await adminService.listUsers()
      setUsersList(list)
    } catch (err) {
      console.error(err)
    } finally {
      setIsUsersLoading(false)
    }
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = userFormData.name.trim()
    const trimmedEmail = userFormData.email.trim().toLowerCase()
    const passwordVal = userFormData.password ? userFormData.password.trim() : ''

    if (!trimmedName) {
      toast.error('Informe o nome do usuário.')
      return
    }

    if (!editingUser) {
      if (!trimmedEmail) {
        toast.error('Informe o e-mail do usuário.')
        return
      }
      if (passwordVal.length < 8) {
        toast.error('A senha deve ter no mínimo 8 caracteres.')
        return
      }
    } else {
      // Edição: se senha informada, validar tamanho mínimo
      if (passwordVal && passwordVal.length < 8) {
        toast.error('A nova senha deve ter no mínimo 8 caracteres.')
        return
      }
    }

    setIsSavingUser(true)
    try {
      if (editingUser) {
        const willChangePassword = passwordVal.length >= 8

        // 1. Atualizar dados do perfil (name, role) via PATCH no registro
        const payload: Record<string, unknown> = {
          name: trimmedName,
          role: userFormData.role,
        }
        await adminService.updateUser(editingUser.id, payload)

        // 2. Se nova senha informada, chamar rota administrativa dedicada
        // (PocketBase exige oldPassword via PATCH de auth record para não-superusers,
        // então usamos a rota /backend/v1/admin-users-set-password com $app superuser)
        if (willChangePassword) {
          await adminService.setUserPassword(editingUser.id, passwordVal)
        }

        // Registrar auditoria sem expor a senha em texto puro
        await adminService.recordManualAudit(
          willChangePassword ? 'ALTERAR_SENHA_USUARIO' : 'EDITAR_USUARIO',
          `users/${editingUser.id}`,
          {
            email: editingUser.email,
            name: trimmedName,
            role: userFormData.role,
            senha_alterada: willChangePassword,
          },
          {
            email: editingUser.email,
            name: editingUser.name,
            role: editingUser.role,
          },
        )

        if (willChangePassword) {
          toast.success(`Senha e dados do usuário "${editingUser.email}" alterados com sucesso!`)
        } else {
          toast.success(`Dados do usuário "${editingUser.email}" salvos. Senha mantida.`)
        }
      } else {
        await adminService.createUser({
          email: trimmedEmail,
          name: trimmedName,
          role: userFormData.role,
          password: passwordVal,
          passwordConfirm: passwordVal,
          emailVisibility: true,
        })

        await adminService.recordManualAudit('CRIAR_USUARIO', `users/${trimmedEmail}`, {
          email: trimmedEmail,
          name: trimmedName,
          role: userFormData.role,
        })

        toast.success(`Usuário "${trimmedEmail}" criado com sucesso!`)
      }

      setIsUserModalOpen(false)
      setUserFormData({ name: '', email: '', role: 'consulta', password: '' })
      setShowPassword(false)
      await loadUsers()
    } catch (err: any) {
      console.error(err)
      const errorMsg =
        err?.data?.error ||
        err?.response?.error ||
        err?.data?.data?.password?.message ||
        err?.data?.data?.email?.message ||
        err?.message ||
        'Erro ao salvar usuário. Verifique se o e-mail é único e válido.'
      toast.error(errorMsg)
    } finally {
      setIsSavingUser(false)
    }
  }

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === user?.id) {
      alert('Você não pode excluir seu próprio usuário.')
      return
    }
    if (!confirm(`Deseja excluir o usuário "${name}"?`)) return
    try {
      await adminService.deleteUser(id)
      await loadUsers()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir usuário.')
    }
  }

  // ---------- AUXILIARES ----------
  const loadAuxItems = async () => {
    setIsAuxLoading(true)
    try {
      let list: Array<{ id: string; nome: string; uf?: string; cor?: string }> = []
      if (auxSubTab === 'segmentos') list = await auxiliaresService.getSegmentos()
      else if (auxSubTab === 'cargos') list = await auxiliaresService.getCargos()
      else if (auxSubTab === 'estados') list = await auxiliaresService.getEstados()
      else if (auxSubTab === 'inside_sales') list = await auxiliaresService.getInsideSales()
      else if (auxSubTab === 'responsaveis') list = await auxiliaresService.getResponsaveis()
      else if (auxSubTab === 'canais_faturamento')
        list = await auxiliaresService.getCanaisFaturamento()
      else if (auxSubTab === 'status_revenda') list = await auxiliaresService.getStatusRevenda()
      setAuxItems(list)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAuxLoading(false)
    }
  }

  const handleCreateAuxItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAuxName.trim()) return

    try {
      const payload: Record<string, unknown> = { nome: newAuxName.trim() }
      if (auxSubTab === 'estados') {
        payload.uf = newAuxUf.trim().toUpperCase() || 'UF'
      }
      if (auxSubTab === 'status_revenda') {
        payload.cor = newAuxCor
      }

      await auxiliaresService.createItem(auxSubTab, payload)
      setNewAuxName('')
      setNewAuxUf('')
      await loadAuxItems()
    } catch (err) {
      console.error(err)
      alert('Erro ao criar item. Verifique se o nome já existe.')
    }
  }

  const handleDeleteAuxItem = async (id: string, nome: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir "${nome}"? Atenção: se estiver em uso em revendas ou contatos, a exclusão poderá ser bloqueada pelo banco de dados.`,
      )
    ) {
      return
    }
    try {
      await auxiliaresService.deleteItem(auxSubTab, id)
      await loadAuxItems()
    } catch (err) {
      console.error(err)
      alert('Não foi possível excluir o item. Ele pode estar sendo utilizado em registros ativos.')
    }
  }

  // ---------- CONFIGURAÇÕES DE E-MAIL ----------
  const loadEmailConfig = async () => {
    try {
      const cfg = await adminService.getEmailConfig()
      setEmailConfig(cfg)
    } catch (err) {
      console.error('Erro ao consultar config de email:', err)
    }
  }

  const loadRemetentes = async () => {
    setIsEmailLoading(true)
    try {
      const list = await auxiliaresService.getRemetentes()
      setRemetentes(list)
    } catch (err) {
      console.error(err)
    } finally {
      setIsEmailLoading(false)
    }
  }

  const handleOpenRemetenteModal = (rem?: Remetente) => {
    if (rem) {
      setEditingRemetente(rem)
      setRemetenteFormData({ nome: rem.nome, email: rem.email })
    } else {
      setEditingRemetente(null)
      setRemetenteFormData({ nome: '', email: '' })
    }
    setRemetenteModalOpen(true)
  }

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim())
  }

  const handleSaveRemetenteModal = async (e: React.FormEvent) => {
    e.preventDefault()
    const nomeLimpo = remetenteFormData.nome.trim()
    const emailLimpo = remetenteFormData.email.trim().toLowerCase()

    if (!nomeLimpo || !emailLimpo) {
      alert('Preencha o nome e o e-mail do remetente.')
      return
    }

    if (!isValidEmail(emailLimpo)) {
      alert('Por favor, informe um endereço de e-mail válido (exemplo: usuario@rolanddg.com.br).')
      return
    }

    // Validação de duplicidade no frontend
    const duplicado = remetentes.some(
      (r) => r.email.toLowerCase() === emailLimpo && r.id !== editingRemetente?.id,
    )
    if (duplicado) {
      alert(`O e-mail "${emailLimpo}" já está cadastrado como remetente permitido.`)
      return
    }

    try {
      if (editingRemetente) {
        await auxiliaresService.updateRemetente(editingRemetente.id, {
          nome: nomeLimpo,
          email: emailLimpo,
        })
      } else {
        await auxiliaresService.createRemetente({
          nome: nomeLimpo,
          email: emailLimpo,
        })
      }
      setRemetenteModalOpen(false)
      await loadRemetentes()
    } catch (err: any) {
      console.error(err)
      const msg =
        err?.data?.data?.email?.message ||
        'Erro ao salvar remetente. Verifique os dados informados.'
      alert(msg)
    }
  }

  const handleCreateRemetente = async (e: React.FormEvent) => {
    e.preventDefault()
    const nomeLimpo = newRemetenteNome.trim()
    const emailLimpo = newRemetenteEmail.trim().toLowerCase()

    if (!nomeLimpo || !emailLimpo) {
      alert('Preencha o nome e o e-mail do remetente.')
      return
    }

    if (!isValidEmail(emailLimpo)) {
      alert('Por favor, informe um endereço de e-mail válido (exemplo: usuario@rolanddg.com.br).')
      return
    }

    const duplicado = remetentes.some((r) => r.email.toLowerCase() === emailLimpo)
    if (duplicado) {
      alert(`O e-mail "${emailLimpo}" já está cadastrado como remetente permitido.`)
      return
    }

    try {
      await auxiliaresService.createRemetente({
        nome: nomeLimpo,
        email: emailLimpo,
      })
      setNewRemetenteNome('')
      setNewRemetenteEmail('')
      await loadRemetentes()
    } catch (err: any) {
      console.error(err)
      const msg =
        err?.data?.data?.email?.message ||
        'Erro ao cadastrar remetente. Verifique se o e-mail é válido e único.'
      alert(msg)
    }
  }

  const handleDeleteRemetente = async (id: string, email: string) => {
    if (!confirm(`Deseja realmente remover o remetente "${email}"?`)) return
    try {
      await auxiliaresService.deleteRemetente(id)
      await loadRemetentes()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir remetente.')
    }
  }

  // ---------- AUDITORIA ----------
  const loadAuditorias = async () => {
    setIsAuditLoading(true)
    try {
      const filter = auditFilterAcao !== 'all' ? `acao = '${auditFilterAcao}'` : ''
      const res = await adminService.listAuditoria(1, 50, filter)
      setAuditorias(res.items)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAuditLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border max-w-lg mx-auto">
        <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-xs text-slate-500 mt-1">
          Apenas usuários com perfil <strong>Administrador</strong> têm permissão para acessar esta
          área.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* TÍTULO E ABAS */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel de Administração</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gestão de usuários, padronização de tabelas, importador de dados e trilhas de auditoria
        </p>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center gap-2 mt-5 border-b border-slate-200 overflow-x-auto">
          {[
            { key: 'usuarios', label: 'Usuários do Sistema', icon: Users },
            { key: 'remetentes', label: 'Remetentes Permitidos', icon: MailCheck },
            { key: 'auxiliares', label: 'Tabelas Auxiliares', icon: Database },
            { key: 'importacao', label: 'Importação XLSX', icon: UploadCloud },
            { key: 'email', label: 'Configurações de E-mail', icon: Mail },
            { key: 'auditoria', label: 'Trilhas de Auditoria', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleSelectTab(tab.key as any)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ==================== ABA 1: USUÁRIOS ==================== */}
      {activeTab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Usuários Cadastrados</h3>
              <p className="text-xs text-slate-400">
                Controle de credenciais e níveis de acesso (Admin / Gestor / Consulta)
              </p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null)
                setShowPassword(false)
                setUserFormData({ name: '', email: '', role: 'consulta', password: '' })
                setIsUserModalOpen(true)
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Usuário</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Criado em</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {u.name || 'Sem nome'}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-700">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : u.role === 'gestor'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {u.role || 'consulta'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(u.created).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(u)
                              setShowPassword(false)
                              setUserFormData({
                                name: u.name || '',
                                email: u.email || '',
                                role: (u.role as any) || 'consulta',
                                password: '',
                              })
                              setIsUserModalOpen(true)
                            }}
                            title="Editar usuário e redefinir senha"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== ABA 2: TABELAS AUXILIARES ==================== */}
      {activeTab === 'auxiliares' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in">
          {/* Sub-abas das tabelas */}
          <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto text-xs font-semibold">
            {[
              { key: 'segmentos', label: 'Segmentos' },
              { key: 'inside_sales', label: 'Inside Sales' },
              { key: 'responsaveis', label: 'Responsáveis' },
              { key: 'canais_faturamento', label: 'Canais Faturamento' },
              { key: 'cargos', label: 'Cargos' },
              { key: 'estados', label: 'Estados (UF)' },
              { key: 'status_revenda', label: 'Status Revenda' },
            ].map((sub) => (
              <button
                key={sub.key}
                onClick={() => setAuxSubTab(sub.key as any)}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  auxSubTab === sub.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Formulário de inserção rápida */}
          <form
            onSubmit={handleCreateAuxItem}
            className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border rounded-xl"
          >
            <input
              type="text"
              required
              placeholder="Nome do registro (ex: DIGITAL PRINTING, DONO, etc)..."
              value={newAuxName}
              onChange={(e) => setNewAuxName(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg bg-white flex-1 min-w-[200px]"
            />
            {auxSubTab === 'estados' && (
              <input
                type="text"
                maxLength={2}
                placeholder="UF (ex: SP)"
                value={newAuxUf}
                onChange={(e) => setNewAuxUf(e.target.value)}
                className="px-2 py-1.5 text-xs border rounded-lg bg-white w-20 uppercase font-mono text-center"
              />
            )}
            {auxSubTab === 'status_revenda' && (
              <input
                type="color"
                value={newAuxCor}
                onChange={(e) => setNewAuxCor(e.target.value)}
                className="w-10 h-8 border rounded-lg bg-white p-0.5 cursor-pointer"
              />
            )}
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </button>
          </form>

          {/* Lista de Itens */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-4">Nome</th>
                  {auxSubTab === 'estados' && <th className="py-2.5 px-4">UF</th>}
                  {auxSubTab === 'status_revenda' && <th className="py-2.5 px-4">Cor</th>}
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isAuxLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : auxItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Nenhum item cadastrado nesta tabela.
                    </td>
                  </tr>
                ) : (
                  auxItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.nome}</td>
                      {auxSubTab === 'estados' && (
                        <td className="py-2.5 px-4 font-mono">{item.uf}</td>
                      )}
                      {auxSubTab === 'status_revenda' && (
                        <td className="py-2.5 px-4">
                          <span
                            className="inline-block w-4 h-4 rounded-full border shadow-sm"
                            style={{ backgroundColor: item.cor || '#2563EB' }}
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteAuxItem(item.id, item.nome)}
                          title="Excluir valor"
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== ABA 2: REMETENTES PERMITIDOS ==================== */}
      {activeTab === 'remetentes' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Card Informativo com Contexto do Fluxo de Envio */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg">
                  <MailCheck className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Remetentes Permitidos para Disparos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {remetentes.length} cadastrado(s)
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Apenas os endereços listados abaixo são autorizados a figurar no cabeçalho{' '}
                <strong>"De" (Sender)</strong> das campanhas de comunicação por e-mail enviadas às
                revendas e contatos. O endereço padrão do fluxo de envio é{' '}
                <strong className="font-mono text-blue-700">nao-responda@rolanddg.com.br</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenRemetenteModal()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap self-start md:self-center"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Remetente</span>
            </button>
          </div>

          {/* Gerenciamento de Remetentes Permitidos (CRUD Completo) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Cadastro Rápido de Remetente</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informe o nome legível e o e-mail corporativo autorizado.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateRemetente}
              className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border rounded-xl text-xs"
            >
              <input
                type="text"
                required
                placeholder="Nome de Exibição (ex: Roland DG Brasil)"
                value={newRemetenteNome}
                onChange={(e) => setNewRemetenteNome(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white flex-1 min-w-[200px]"
              />
              <input
                type="email"
                required
                placeholder="E-mail (ex: comunicados@rolanddg.com.br)"
                value={newRemetenteEmail}
                onChange={(e) => setNewRemetenteEmail(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white flex-1 min-w-[200px] font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Remetente</span>
              </button>
            </form>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3 px-4">Nome de Exibição</th>
                    <th className="py-3 px-4">E-mail Autorizado</th>
                    <th className="py-3 px-4 text-center">Padrão do Sistema</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {isEmailLoading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" />
                      </td>
                    </tr>
                  ) : remetentes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Nenhum remetente cadastrado. Adicione um para permitir disparos de
                        comunicados.
                      </td>
                    </tr>
                  ) : (
                    remetentes.map((r) => {
                      const isDefault = r.email.toLowerCase() === 'nao-responda@rolanddg.com.br'
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                            <span>{r.nome}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-blue-700">{r.email}</td>
                          <td className="py-3 px-4 text-center">
                            {isDefault ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                Padrão de Envio
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenRemetenteModal(r)}
                                title="Editar remetente"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRemetente(r.id, r.email)}
                                title="Excluir remetente"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ABA 3: TABELAS AUXILIARES ==================== */}
      {/* (aba 'auxiliares' mantida abaixo) */}

      {/* ==================== ABA 4: WIZARD DE IMPORTAÇÃO ==================== */}
      {activeTab === 'importacao' && <ImportWizard />}

      {/* ==================== ABA 5: CONFIGURAÇÕES DE E-MAIL ==================== */}
      {activeTab === 'email' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Card de Diagnóstico do Provedor de Envio */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Diagnóstico do Provedor de Envio</span>
                  {emailConfig?.configured ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      SMTP Corporativo Ativo
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Modo Simulado Ativo
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verifique o status da entrega real de mensagens para as caixas de entrada dos
                  destinatários.
                </p>
              </div>
              <button
                type="button"
                onClick={loadEmailConfig}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Atualizar Diagnóstico</span>
              </button>
            </div>

            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed ${
                emailConfig?.configured
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-semibold mb-1">
                {emailConfig?.configured
                  ? '✓ Servidor SMTP Conectado'
                  : 'ℹ️ Atenção: Os disparos atuais são SIMULADOS'}
              </div>
              <div>{emailConfig?.message || 'Carregando diagnóstico do servidor de e-mail...'}</div>
              {!emailConfig?.configured && (
                <div className="mt-2.5 pt-2 border-t border-amber-200 text-[11px] text-amber-800 space-y-1">
                  <p className="font-semibold">Como ativar o envio real de e-mails:</p>
                  <p>
                    Configure as variáveis de ambiente SMTP nas configurações do projeto (Cloud):
                  </p>
                  <code className="block bg-amber-100/70 p-2 rounded text-[11px] font-mono mt-1 text-slate-800">
                    SMTP_HOST=smtp.exemplo.com.br
                    <br />
                    SMTP_PORT=587
                    <br />
                    SMTP_USER=usuario@exemplo.com.br
                    <br />
                    SMTP_PASS=senha_de_aplicativo
                    <br />
                    SMTP_FROM=comunicados@rolanddg.com.br
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Gerenciamento de Remetentes Permitidos (CRUD Completo) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Remetentes Permitidos</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    (disponível também na aba principal "Remetentes Permitidos")
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Endereços autorizados a figurar no campo "De" nos disparos de comunicados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectTab('remetentes')}
                  className="px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Abrir Seção Dedicada →
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenRemetenteModal()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Remetente</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleCreateRemetente}
              className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border rounded-xl text-xs"
            >
              <input
                type="text"
                required
                placeholder="Nome de Exibição (ex: Roland DG Brasil)"
                value={newRemetenteNome}
                onChange={(e) => setNewRemetenteNome(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white flex-1 min-w-[200px]"
              />
              <input
                type="email"
                required
                placeholder="E-mail (ex: comunicados@rolanddg.com.br)"
                value={newRemetenteEmail}
                onChange={(e) => setNewRemetenteEmail(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white flex-1 min-w-[200px] font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Rápido</span>
              </button>
            </form>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3 px-4">Nome de Exibição</th>
                    <th className="py-3 px-4">E-mail Autorizado</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {isEmailLoading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-600" />
                      </td>
                    </tr>
                  ) : remetentes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Nenhum remetente cadastrado. Adicione um para poder disparar comunicados.
                      </td>
                    </tr>
                  ) : (
                    remetentes.map((r) => {
                      const isDefault = r.email.toLowerCase() === 'nao-responda@rolanddg.com.br'
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-slate-900">{r.nome}</td>
                          <td className="py-3 px-4 font-mono text-blue-700">{r.email}</td>
                          <td className="py-3 px-4 text-center">
                            {isDefault ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                Padrão do Sistema
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenRemetenteModal(r)}
                                title="Editar remetente"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRemetente(r.id, r.email)}
                                title="Excluir remetente"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / NOVO REMETENTE */}
      {remetenteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 scale-in">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRemetente ? 'Editar Remetente Permitido' : 'Novo Remetente Permitido'}
              </h3>
              <button
                onClick={() => setRemetenteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRemetenteModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome de Exibição *
                </label>
                <input
                  type="text"
                  required
                  value={remetenteFormData.nome}
                  onChange={(e) =>
                    setRemetenteFormData({ ...remetenteFormData, nome: e.target.value })
                  }
                  placeholder="Ex: Roland DG Brasil - Comunicações"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail Autorizado *
                </label>
                <input
                  type="email"
                  required
                  value={remetenteFormData.email}
                  onChange={(e) =>
                    setRemetenteFormData({ ...remetenteFormData, email: e.target.value })
                  }
                  placeholder="Ex: comunicados@rolanddg.com.br"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemetenteModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Salvar Remetente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ABA 5: AUDITORIA ==================== */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Trilha de Auditoria do Sistema</h3>
              <p className="text-xs text-slate-400">
                Registro cronológico de alterações com antes/depois em formato estruturado
              </p>
            </div>
            <select
              value={auditFilterAcao}
              onChange={(e) => setAuditFilterAcao(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg bg-slate-50"
            >
              <option value="all">Todas as Ações</option>
              <option value="CRIAR">CRIAR</option>
              <option value="EDITAR">EDITAR</option>
              <option value="EXCLUIR">EXCLUIR</option>
              <option value="IMPORTAR">IMPORTAR</option>
            </select>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Data/Hora</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Registro</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {isAuditLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : auditorias.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum registro de auditoria gravado ainda.
                    </td>
                  </tr>
                ) : (
                  auditorias.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(a.data_hora || a.created).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.acao === 'CRIAR'
                              ? 'bg-emerald-50 text-emerald-700'
                              : a.acao === 'EDITAR'
                                ? 'bg-amber-50 text-amber-700'
                                : a.acao === 'EXCLUIR'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {a.acao}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">{a.registro}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {a.expand?.usuario?.name ||
                          a.expand?.usuario?.email ||
                          'Sistema / Automático'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedAudit(a)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Ver JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL JSON AUDITORIA */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col scale-in overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Auditoria: {selectedAudit.acao} • {selectedAudit.registro}
              </h3>
              <button
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {selectedAudit.valor_anterior && (
                <div>
                  <h4 className="font-bold text-rose-600 font-sans mb-1">Valor Anterior:</h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedAudit.valor_anterior, null, 2)}
                  </pre>
                </div>
              )}
              {selectedAudit.novo_valor && (
                <div>
                  <h4 className="font-bold text-emerald-600 font-sans mb-1">Novo Valor:</h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedAudit.novo_valor, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedAudit(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO/EDITAR USUÁRIO */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingUser ? 'Editar Usuário e Senha' : 'Novo Usuário do Sistema'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingUser
                      ? 'Altere perfil, nome ou defina uma nova senha'
                      : 'Cadastre credencial de acesso ao sistema'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="Nome do operador..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="usuario@rolanddg.com.br"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 text-xs"
                />
                {editingUser && (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    O e-mail é o identificador único da conta e não pode ser alterado aqui.
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                <select
                  value={userFormData.role}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, role: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                >
                  <option value="admin">Administrador (Acesso total)</option>
                  <option value="gestor">Gestor (Cadastros & Comunicações)</option>
                  <option value="consulta">Consulta (Somente leitura)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-800">
                    {editingUser ? 'Nova Senha' : 'Senha de Acesso'}
                  </label>
                  <span className="text-[10px] font-medium text-slate-500">
                    {editingUser ? 'Opcional (min. 8 car.)' : 'Obrigatória (min. 8 car.)'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder={
                      editingUser
                        ? 'Deixe vazio para manter a senha atual'
                        : 'Mínimo de 8 caracteres'
                    }
                    className="w-full pl-3 pr-9 py-2 border rounded-lg focus:outline-none focus:border-blue-500 bg-white text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {editingUser ? (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {userFormData.password.trim() ? (
                      <span className="text-blue-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                        A senha deste usuário será redefinida ao salvar.
                      </span>
                    ) : (
                      'Deixe em branco para preservar a senha atual sem qualquer modificação.'
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    A senha cadastrada permitirá o login imediato no sistema.
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingUser}
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingUser && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
