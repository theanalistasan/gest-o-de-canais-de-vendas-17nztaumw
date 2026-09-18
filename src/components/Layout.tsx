import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Store,
  Users,
  Send,
  History,
  ShieldCheck,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { GlobalSearch } from './GlobalSearch'
import pb from '@/lib/pocketbase/client'

export default function Layout() {
  const { user, role, logout, isAdmin } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [errosUltimas24h, setErrosUltimas24h] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  // Fechar drawer no mobile ao trocar de rota
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  // Checar envios com erro nas últimas 24h para o badge de notificação
  useEffect(() => {
    const fetchErrors = async () => {
      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const count = await pb.collection('envios').getList(1, 1, {
          filter: `erro = true && created >= '${yesterday}'`,
        })
        setErrosUltimas24h(count.totalItems)
      } catch (_) {
        // silencioso
      }
    }

    fetchErrors()
    const interval = setInterval(fetchErrors, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/revendas', label: 'Revendas', icon: Store },
    { to: '/contatos', label: 'Contatos', icon: Users },
    { to: '/comunicacoes', label: 'Comunicações', icon: Send },
    { to: '/historico', label: 'Histórico', icon: History },
    ...(isAdmin ? [{ to: '/administracao', label: 'Administração', icon: ShieldCheck }] : []),
  ]

  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard')) return 'Dashboard Executivo'
    if (path.startsWith('/revendas')) return 'Gestão de Revendas'
    if (path.startsWith('/contatos')) return 'Cadastro Central de Contatos'
    if (path.startsWith('/comunicacoes')) return 'Comunicações Segmentadas'
    if (path.startsWith('/historico')) return 'Histórico de Envios'
    if (path.startsWith('/administracao')) return 'Painel de Administração'
    return 'Gestão de Canais'
  }

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            Admin
          </span>
        )
      case 'gestor':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            Gestor
          </span>
        )
      default:
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-400/30">
            Consulta
          </span>
        )
    }
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden font-sans text-slate-900">
      {/* MOBILE DRAWER OVERLAY */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0F172A] text-slate-100 transition-all duration-300 ease-in-out border-r border-slate-800 ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-60'}`}
      >
        {/* Topo / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/30">
                GC
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight leading-none">
                  Gestão de Canais
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">Vendas & Revendas</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/30">
              GC
            </div>
          )}

          {/* Botão fechar no mobile */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Itens do Menu */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-l-4 border-cyan-400 pl-2'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-105`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Rodapé da Sidebar: Usuário + Sair */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white border border-slate-600 flex-shrink-0">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-100 truncate">
                    {user?.name || user?.email || 'Usuário'}
                  </p>
                  <div className="mt-0.5">{getRoleBadge(role)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair do sistema"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white border border-slate-600"
                title={user?.name || user?.email || 'Usuário'}
              >
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Toggle colapsar (somente desktop) */}
          <div className="hidden lg:flex justify-end mt-2 pt-2 border-t border-slate-800/50">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full py-1 flex items-center justify-center text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded transition-colors"
              title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-30 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hambúrguer Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight hidden sm:block">
              {getPageTitle()}
            </h2>
          </div>

          {/* Pesquisa Global + Ações */}
          <div className="flex items-center gap-4 flex-1 justify-end max-w-2xl">
            <GlobalSearch />

            {/* Ícone de Alertas/Erros recentes */}
            <NavLink
              to="/historico?status=Erro"
              title={
                errosUltimas24h > 0
                  ? `${errosUltimas24h} envio(s) com erro nas últimas 24h`
                  : 'Nenhum erro de envio recente'
              }
              className="relative p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <AlertTriangle
                className={`h-5 w-5 ${errosUltimas24h > 0 ? 'text-amber-500' : 'text-slate-400'}`}
              />
              {errosUltimas24h > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                  {errosUltimas24h > 9 ? '9+' : errosUltimas24h}
                </span>
              )}
            </NavLink>

            {/* Avatar Header */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {user?.name ? user.name.substring(0, 1).toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-medium text-slate-700 hidden md:block max-w-[120px] truncate">
                {user?.name || user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (Scroll próprio) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F1F5F9] focus:outline-none">
          <Outlet />
        </main>

        {/* FOOTER */}
        <footer className="h-9 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
          <span>Gestão de Canais de Vendas & Revendas © {new Date().getFullYear()}</span>
          <span>Versão 1.0 • Roland DG Brasil</span>
        </footer>
      </div>
    </div>
  )
}
