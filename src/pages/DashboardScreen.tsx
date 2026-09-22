import React, { useState, useEffect, useMemo, useTransition } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  CheckCircle2,
  XCircle,
  Users,
  MailWarning,
  Filter,
  RotateCcw,
  ExternalLink,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { AnimatedCounter } from '@/components/AnimatedCounter'
import { revendasService, contatosService, auxiliaresService } from '@/services/apiService'
import type {
  Revenda,
  Contato,
  Segmento,
  Estado,
  InsideSales,
  Responsavel,
  CanalFaturamento,
  StatusRevenda,
} from '@/types'

const COLORS = ['#2563EB', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#64748B']

export const DashboardScreen: React.FC = () => {
  const [, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])

  // Auxiliares
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [insideSales, setInsideSales] = useState<InsideSales[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [canais, setCanais] = useState<CanalFaturamento[]>([])
  const [statusRevenda, setStatusRevenda] = useState<StatusRevenda[]>([])

  // Filtros Globais Interativos
  const [selectedSegmento, setSelectedSegmento] = useState<string>('all')
  const [selectedEstado, setSelectedEstado] = useState<string>('all')
  const [selectedInside, setSelectedInside] = useState<string>('all')
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>('all')
  const [selectedCanal, setSelectedCanal] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [rData, cData, segs, ests, ins, resps, can, stats] = await Promise.all([
        revendasService.getAll(),
        contatosService.getAll(),
        auxiliaresService.getSegmentos(),
        auxiliaresService.getEstados(),
        auxiliaresService.getInsideSales(),
        auxiliaresService.getResponsaveis(),
        auxiliaresService.getCanaisFaturamento(),
        auxiliaresService.getStatusRevenda(),
      ])

      setRevendas(rData)
      setContatos(cData)
      setSegmentos(segs)
      setEstados(ests)
      setInsideSales(ins)
      setResponsaveis(resps)
      setCanais(can)
      setStatusRevenda(stats)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem reativa das revendas em memória
  const filteredRevendas = useMemo(() => {
    return revendas.filter((r) => {
      if (selectedSegmento !== 'all' && r.segmento !== selectedSegmento) return false
      if (selectedEstado !== 'all' && r.estado !== selectedEstado) return false
      if (selectedInside !== 'all' && r.inside_sales !== selectedInside) return false
      if (selectedResponsavel !== 'all' && r.responsavel !== selectedResponsavel) return false
      if (selectedCanal !== 'all' && r.canal_faturamento !== selectedCanal) return false
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false
      return true
    })
  }, [
    revendas,
    selectedSegmento,
    selectedEstado,
    selectedInside,
    selectedResponsavel,
    selectedCanal,
    selectedStatus,
  ])

  // Contatos pertencentes às revendas filtradas
  const filteredRevendaIds = useMemo(
    () => new Set(filteredRevendas.map((r) => r.id)),
    [filteredRevendas],
  )
  const filteredContatos = useMemo(() => {
    return contatos.filter((c) => filteredRevendaIds.has(c.revenda))
  }, [contatos, filteredRevendaIds])

  // KPIs
  const totalRevendas = filteredRevendas.length

  const revendasAtivas = useMemo(() => {
    return filteredRevendas.filter((r) => {
      const statusNome = r.expand?.status?.nome?.toLowerCase() || ''
      return statusNome.includes('ativ') && !statusNome.includes('descred')
    }).length
  }, [filteredRevendas])

  const revendasDescredenciadas = useMemo(() => {
    return filteredRevendas.filter((r) => {
      const statusNome = r.expand?.status?.nome?.toLowerCase() || ''
      return statusNome.includes('descred') || statusNome.includes('inativ')
    }).length
  }, [filteredRevendas])

  const totalContatos = filteredContatos.length
  const contatosSemEmail = useMemo(() => {
    return filteredContatos.filter((c) => !c.email && !c.email_secundario).length
  }, [filteredContatos])

  // Gráfico 1: Revendas por Estado (Barras horizontais)
  const dataPorEstado = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filteredRevendas) {
      const uf = r.expand?.estado?.uf || r.expand?.estado?.nome || 'N/I'
      counts[uf] = (counts[uf] || 0) + 1
    }
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [filteredRevendas])

  // Mapa de auxílio para garantir nomes corretos mesmo se expand falhar
  const segmentoMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of segmentos) {
      map.set(s.id, s.nome)
    }
    return map
  }, [segmentos])

  const canalMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of canais) {
      map.set(c.id, c.nome)
    }
    return map
  }, [canais])

  // Gráfico 2: Revendas por Segmento (Donut)
  const dataPorSegmento = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filteredRevendas) {
      const seg =
        r.expand?.segmento?.nome ||
        (r.segmento ? segmentoMap.get(r.segmento) : null) ||
        'Não definido'
      counts[seg] = (counts[seg] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredRevendas, segmentoMap])

  // Gráfico 3: Revendas por Inside Sales (Barras verticais)
  const dataPorInside = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filteredRevendas) {
      const inside = r.expand?.inside_sales?.nome || 'Sem Inside'
      counts[inside] = (counts[inside] || 0) + 1
    }
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [filteredRevendas])

  // Gráfico 4: Revendas por Canal de Faturamento (Donut)
  const dataPorCanal = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filteredRevendas) {
      const canal =
        r.expand?.canal_faturamento?.nome ||
        (r.canal_faturamento ? canalMap.get(r.canal_faturamento) : null) ||
        'Não definido'
      counts[canal] = (counts[canal] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredRevendas, canalMap])

  // Últimas 5 Revendas Atualizadas
  const ultimasAtualizadas = useMemo(() => {
    return [...filteredRevendas]
      .sort(
        (a, b) =>
          new Date(b.updated || b.created).getTime() - new Date(a.updated || a.created).getTime(),
      )
      .slice(0, 5)
  }, [filteredRevendas])

  const limparFiltros = () => {
    startTransition(() => {
      setSelectedSegmento('all')
      setSelectedEstado('all')
      setSelectedInside('all')
      setSelectedResponsavel('all')
      setSelectedCanal('all')
      setSelectedStatus('all')
    })
  }

  const hasActiveFilters =
    selectedSegmento !== 'all' ||
    selectedEstado !== 'all' ||
    selectedInside !== 'all' ||
    selectedResponsavel !== 'all' ||
    selectedCanal !== 'all' ||
    selectedStatus !== 'all'

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span>Consolidando dados executivos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* BARRA DE FILTROS GLOBAIS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>Filtros Globais Interativos</span>
            <span className="text-xs font-normal text-slate-400">
              (Os KPIs e gráficos reagem instantaneamente)
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Segmento */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Segmento
            </label>
            <select
              value={selectedSegmento}
              onChange={(e) => setSelectedSegmento(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
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
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Estado
            </label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os estados</option>
              {estados.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.uf} - {est.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Inside Sales */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Inside Sales
            </label>
            <select
              value={selectedInside}
              onChange={(e) => setSelectedInside(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Insides</option>
              {insideSales.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Responsável Comercial */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Responsável
            </label>
            <select
              value={selectedResponsavel}
              onChange={(e) => setSelectedResponsavel(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os responsáveis</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Canal de Faturamento */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Canal Faturamento
            </label>
            <select
              value={selectedCanal}
              onChange={(e) => setSelectedCanal(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
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
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
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

      {/* 5 CARDS DE KPIS ANIMADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revendas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Revendas
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Store className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            <AnimatedCounter value={totalRevendas} />
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Cadastros no sistema</span>
          </p>
        </div>

        {/* Revendas Ativas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Revendas Ativas
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            <AnimatedCounter value={revendasAtivas} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalRevendas > 0
              ? `${Math.round((revendasAtivas / totalRevendas) * 100)}% da base`
              : '0%'}
          </p>
        </div>

        {/* Revendas Descredenciadas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Descredenciadas
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            <AnimatedCounter value={revendasDescredenciadas} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Inativas / Descredenciadas</p>
        </div>

        {/* Total de Contatos */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Contatos
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            <AnimatedCounter value={totalContatos} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Pessoas vinculadas</p>
        </div>

        {/* Contatos sem E-mail */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sem E-mail
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <MailWarning className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            <AnimatedCounter value={contatosSemEmail} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Necessitam atualização</p>
        </div>
      </div>

      {/* GRÁFICOS RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Revendas por Estado */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Revendas por Estado (Top 10)</span>
            <span className="text-xs font-normal text-slate-400">Distribuição geográfica</span>
          </h3>
          <div className="h-64">
            {dataPorEstado.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataPorEstado}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
                >
                  <XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={40} stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                    }}
                    formatter={(v: unknown) => [String(v) + ' revendas', 'Total']}
                  />
                  <Bar dataKey="total" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado com os filtros atuais
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Revendas por Segmento */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Revendas por Segmento</span>
            <span className="text-xs font-normal text-slate-400">Divisão mercadológica</span>
          </h3>
          <div className="h-72 flex items-center">
            {dataPorSegmento.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPorSegmento}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={46}
                    outerRadius={74}
                    paddingAngle={3}
                  >
                    {dataPorSegmento.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                    }}
                    formatter={(v: unknown, name: unknown) => [
                      `${String(v)} revendas`,
                      String(name),
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 8, fontSize: '11px', color: '#475569' }}
                    formatter={(value: string, entry: any) => {
                      const payload = entry?.payload as { value?: number } | undefined
                      const count = payload?.value ?? 0
                      return (
                        <span className="text-slate-700 font-medium">
                          {value} <span className="text-slate-400 font-normal">({count})</span>
                        </span>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full text-center text-xs text-slate-400">
                Nenhum dado com os filtros atuais
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Revendas por Inside Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Revendas por Inside Sales</span>
            <span className="text-xs font-normal text-slate-400">Distribuição da carteira</span>
          </h3>
          <div className="h-64">
            {dataPorInside.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataPorInside}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={10}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                    }}
                    formatter={(v: unknown) => [String(v) + ' revendas', 'Carteira']}
                  />
                  <Bar dataKey="total" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado com os filtros atuais
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 4: Revendas por Canal de Faturamento */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Revendas por Canal de Faturamento</span>
            <span className="text-xs font-normal text-slate-400">Modalidade de faturamento</span>
          </h3>
          <div className="h-72 flex items-center">
            {dataPorCanal.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPorCanal}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={46}
                    outerRadius={74}
                    paddingAngle={3}
                  >
                    {dataPorCanal.map((_, index) => (
                      <Cell
                        key={`cell-canal-${index}`}
                        fill={COLORS[(index + 2) % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                    }}
                    formatter={(v: unknown, name: unknown) => [
                      `${String(v)} revendas`,
                      String(name),
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 8, fontSize: '11px', color: '#475569' }}
                    formatter={(value: string, entry: any) => {
                      const payload = entry?.payload as { value?: number } | undefined
                      const count = payload?.value ?? 0
                      return (
                        <span className="text-slate-700 font-medium">
                          {value} <span className="text-slate-400 font-normal">({count})</span>
                        </span>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full text-center text-xs text-slate-400">
                Nenhum dado com os filtros atuais
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABELA: ÚLTIMAS REVENDAS ATUALIZADAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Últimas Revendas Atualizadas</h3>
            <p className="text-xs text-slate-400">Registros modificados recentemente no sistema</p>
          </div>
          <Link
            to="/revendas"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Ver todas</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Razão / Nome</th>
                <th className="py-3 px-4">Segmento</th>
                <th className="py-3 px-4">UF / Cidade</th>
                <th className="py-3 px-4">Inside Sales</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ultimasAtualizadas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Nenhuma revenda cadastrada ainda. Use a aba "Administração &gt; Importação" para
                    carregar sua planilha.
                  </td>
                </tr>
              ) : (
                ultimasAtualizadas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-blue-700">
                      {r.codigo || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.nome}</td>
                    <td className="py-3 px-4 text-slate-600">{r.expand?.segmento?.nome || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.expand?.estado?.uf ? `${r.expand.estado.uf}` : ''}
                      {r.cidade ? ` / ${r.cidade}` : ''}
                      {!r.expand?.estado?.uf && !r.cidade ? '—' : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.expand?.inside_sales?.nome || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {r.expand?.status?.nome || 'Ativa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/revendas/${r.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>Detalhes</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
