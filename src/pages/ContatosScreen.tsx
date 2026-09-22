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
  ChevronDown,
  ChevronRight,
  Building2,
  Layers,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { contatosService, revendasService, auxiliaresService } from '@/services/apiService'
import { exportToCSV } from '@/lib/exportCsv'
import type {
  Contato,
  Revenda,
  Cargo,
  Segmento,
  Estado,
  InsideSales,
  Responsavel,
  CanalFaturamento,
} from '@/types'

export type GroupByOption = 'none' | 'inside_sales' | 'responsavel' | 'revenda'

export type ContatoSortField =
  | 'inside_sales'
  | 'faturamento'
  | 'revenda'
  | 'nome'
  | 'telefone'
  | 'email'
  | 'cargo'
  | 'segmento'
  | 'estado_cidade'
  | 'status'
  | 'contato_principal'
  | 'recebe_comunicacoes'
  | 'observacoes'
  | 'updated'

export const ContatosScreen: React.FC = () => {
  const { canWrite } = useAuth()
  const [, startTransition] = useTransition()
  const [searchParams] = useSearchParams()

  const [contatos, setContatos] = useState<Contato[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [insideSalesList, setInsideSalesList] = useState<InsideSales[]>([])
  const [responsaveisList, setResponsaveisList] = useState<Responsavel[]>([])
  const [canaisFaturamentoList, setCanaisFaturamentoList] = useState<CanalFaturamento[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchGeral, setSearchGeral] = useState(searchParams.get('search') || '')
  const [filterSegmento, setFilterSegmento] = useState('all')
  const [filterRevenda, setFilterRevenda] = useState('all')
  const [filterCargo, setFilterCargo] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPrincipal, setFilterPrincipal] = useState('all')
  const [filterComunicacoes, setFilterComunicacoes] = useState('all')
  const [filterInsideSales, setFilterInsideSales] = useState('all')
  const [filterResponsavel, setFilterResponsavel] = useState('all')
  const [filterCanal, setFilterCanal] = useState('all')

  // Ordenação
  const [sortField, setSortField] = useState<ContatoSortField>('inside_sales')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Paginação no modo Lista Plana
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  // Agrupamento colapsável: 'none' | 'inside_sales' | 'responsavel' | 'revenda'
  const [groupBy, setGroupBy] = useState<GroupByOption>('revenda')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  // Paginação no modo Agrupado
  const [groupPage, setGroupPage] = useState(1)
  const [groupsPerPage, setGroupsPerPage] = useState<'all' | number>('all')

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
      const [cList, rList, cgList, sList, eList, isList, respList, canList] = await Promise.all([
        contatosService.getAll(),
        revendasService.getAll(),
        auxiliaresService.getCargos(),
        auxiliaresService.getSegmentos(),
        auxiliaresService.getEstados(),
        auxiliaresService.getInsideSales(),
        auxiliaresService.getResponsaveis(),
        auxiliaresService.getCanaisFaturamento(),
      ])

      setContatos(cList)
      setRevendas(rList)
      setCargos(cgList)
      setSegmentos(sList)
      setEstados(eList)
      setInsideSalesList(isList)
      setResponsaveisList(respList)
      setCanaisFaturamentoList(canList)
    } catch (err) {
      console.error('Erro ao carregar contatos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mapa de revendas indexado por id (com acesso rápido ao segmento e outros campos)
  const revendaMap = useMemo(() => {
    const map = new Map<string, Revenda>()
    for (const r of revendas) {
      map.set(r.id, r)
    }
    return map
  }, [revendas])

  // Mapas de auxiliares indexados por ID
  const insideSalesMap = useMemo(() => {
    const map = new Map<string, InsideSales>()
    for (const item of insideSalesList) {
      map.set(item.id, item)
    }
    return map
  }, [insideSalesList])

  const responsavelMap = useMemo(() => {
    const map = new Map<string, Responsavel>()
    for (const item of responsaveisList) {
      map.set(item.id, item)
    }
    return map
  }, [responsaveisList])

  const canalFaturamentoMap = useMemo(() => {
    const map = new Map<string, CanalFaturamento>()
    for (const item of canaisFaturamentoList) {
      map.set(item.id, item)
    }
    return map
  }, [canaisFaturamentoList])

  const segmentoMap = useMemo(() => {
    const map = new Map<string, Segmento>()
    for (const item of segmentos) {
      map.set(item.id, item)
    }
    return map
  }, [segmentos])

  const cargoMap = useMemo(() => {
    const map = new Map<string, Cargo>()
    for (const item of cargos) {
      map.set(item.id, item)
    }
    return map
  }, [cargos])

  const estadoMap = useMemo(() => {
    const map = new Map<string, Estado>()
    for (const item of estados) {
      map.set(item.id, item)
    }
    return map
  }, [estados])

  // Helper para obter os dados completos de uma revenda associada ao contato
  const getContatoRevendaInfo = (c: Contato) => {
    const rev = c.revenda ? revendaMap.get(c.revenda) : c.expand?.revenda

    const insideSalesNome =
      (rev?.inside_sales ? insideSalesMap.get(rev.inside_sales)?.nome : undefined) ||
      rev?.expand?.inside_sales?.nome ||
      c.expand?.['revenda.inside_sales']?.nome ||
      ''

    const responsavelNome =
      (rev?.responsavel ? responsavelMap.get(rev.responsavel)?.nome : undefined) ||
      rev?.expand?.responsavel?.nome ||
      c.expand?.['revenda.responsavel']?.nome ||
      ''

    const canalFaturamentoNome =
      (rev?.canal_faturamento ? canalFaturamentoMap.get(rev.canal_faturamento)?.nome : undefined) ||
      rev?.expand?.canal_faturamento?.nome ||
      c.expand?.['revenda.canal_faturamento']?.nome ||
      ''

    const segmentoNome =
      (rev?.segmento ? segmentoMap.get(rev.segmento)?.nome : undefined) ||
      rev?.expand?.segmento?.nome ||
      c.expand?.['revenda.segmento']?.nome ||
      ''

    const estadoUf =
      (rev?.estado ? estadoMap.get(rev.estado)?.uf : undefined) ||
      rev?.expand?.estado?.uf ||
      c.expand?.['revenda.estado']?.uf ||
      ''

    const cargoNome =
      (c.cargo ? cargoMap.get(c.cargo)?.nome : undefined) || c.expand?.cargo?.nome || ''

    return {
      rev,
      revendaId: rev?.id || c.revenda || 'sem_revenda',
      revendaNome: rev?.nome || 'Revenda não identificada',
      revendaCodigo: rev?.codigo || '',
      revendaCidade: rev?.cidade || '',
      insideSalesId: rev?.inside_sales || '',
      insideSalesNome,
      responsavelId: rev?.responsavel || '',
      responsavelNome,
      canalFaturamentoId: rev?.canal_faturamento || '',
      canalFaturamentoNome,
      segmentoId: rev?.segmento || '',
      segmentoNome,
      estadoUf,
      cidade: rev?.cidade || '',
      cargoNome,
    }
  }

  // Contagem de REVENDAS DISTINTAS por segmento (obedecendo ao pedido explícito do usuário)
  // Cada revenda é computada uma única vez pelo seu ID e classificada pelo segmento
  const statsRevendasPorSegmento = useMemo(() => {
    // Mapa auxiliar: segmentoId ou "sem_segmento" => Set de IDs de revendas
    const mapSeg = new Map<string, Set<string>>()
    for (const s of segmentos) {
      mapSeg.set(s.id, new Set<string>())
    }
    const semSegmentoSet = new Set<string>()

    for (const r of revendas) {
      if (r.segmento && mapSeg.has(r.segmento)) {
        mapSeg.get(r.segmento)!.add(r.id)
      } else {
        semSegmentoSet.add(r.id)
      }
    }

    const items = segmentos.map((s) => ({
      id: s.id,
      nome: s.nome,
      totalRevendas: mapSeg.get(s.id)?.size || 0,
    }))

    return {
      items,
      totalGeralRevendas: revendas.length,
      semSegmento: semSegmentoSet.size,
    }
  }, [segmentos, revendas])

  // Filtragem
  const filteredContatos = useMemo(() => {
    const q = searchGeral.toLowerCase().trim()
    return contatos.filter((c) => {
      const info = getContatoRevendaInfo(c)
      const rev = info.rev

      if (q) {
        const matchesNome = c.nome.toLowerCase().includes(q)
        const matchesEmail =
          c.email?.toLowerCase().includes(q) || c.email_secundario?.toLowerCase().includes(q)
        const matchesTel =
          c.telefone?.includes(q) || c.celular?.includes(q) || c.whatsapp?.includes(q)
        const matchesRev = rev?.nome?.toLowerCase().includes(q) || false
        const matchesRevCodigo = rev?.codigo?.toLowerCase().includes(q) || false
        const matchesInside = info.insideSalesNome.toLowerCase().includes(q)
        const matchesResp = info.responsavelNome.toLowerCase().includes(q)
        const matchesCanal = info.canalFaturamentoNome.toLowerCase().includes(q)
        if (
          !matchesNome &&
          !matchesEmail &&
          !matchesTel &&
          !matchesRev &&
          !matchesRevCodigo &&
          !matchesInside &&
          !matchesResp &&
          !matchesCanal
        )
          return false
      }

      // Filtro por Segmento
      if (filterSegmento !== 'all') {
        if (filterSegmento === 'sem_segmento') {
          if (info.segmentoId) return false
        } else if (info.segmentoId !== filterSegmento) {
          return false
        }
      }

      if (filterRevenda !== 'all' && c.revenda !== filterRevenda) return false
      if (filterCargo !== 'all' && c.cargo !== filterCargo) return false
      if (filterInsideSales !== 'all' && info.insideSalesId !== filterInsideSales) return false
      if (filterResponsavel !== 'all' && info.responsavelId !== filterResponsavel) return false
      if (filterCanal !== 'all' && info.canalFaturamentoId !== filterCanal) return false
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
    filterSegmento,
    filterRevenda,
    filterCargo,
    filterInsideSales,
    filterResponsavel,
    filterCanal,
    filterStatus,
    filterPrincipal,
    filterComunicacoes,
    revendaMap,
    insideSalesMap,
    responsavelMap,
    canalFaturamentoMap,
    segmentoMap,
    cargoMap,
    estadoMap,
  ])

  // Ordenação dos contatos
  const sortedContatos = useMemo(() => {
    return [...filteredContatos].sort((a, b) => {
      const infoA = getContatoRevendaInfo(a)
      const infoB = getContatoRevendaInfo(b)
      let valA = ''
      let valB = ''

      switch (sortField) {
        case 'inside_sales':
          valA = infoA.insideSalesNome
          valB = infoB.insideSalesNome
          break
        case 'faturamento':
          valA = infoA.canalFaturamentoNome
          valB = infoB.canalFaturamentoNome
          break
        case 'revenda':
          valA = infoA.revendaNome
          valB = infoB.revendaNome
          break
        case 'nome':
          valA = a.nome
          valB = b.nome
          break
        case 'telefone':
          valA = a.telefone || a.celular || a.whatsapp || ''
          valB = b.telefone || b.celular || b.whatsapp || ''
          break
        case 'email':
          valA = a.email || a.email_secundario || ''
          valB = b.email || b.email_secundario || ''
          break
        case 'cargo':
          valA = infoA.cargoNome
          valB = infoB.cargoNome
          break
        case 'segmento':
          valA = infoA.segmentoNome
          valB = infoB.segmentoNome
          break
        case 'estado_cidade':
          valA = `${infoA.estadoUf} ${infoA.cidade}`.trim()
          valB = `${infoB.estadoUf} ${infoB.cidade}`.trim()
          break
        case 'status':
          valA = a.status_contato || 'Ativo'
          valB = b.status_contato || 'Ativo'
          break
        case 'contato_principal':
          valA = a.contato_principal ? '1' : '0'
          valB = b.contato_principal ? '1' : '0'
          break
        case 'recebe_comunicacoes':
          valA = a.recebe_comunicacoes !== false ? '1' : '0'
          valB = b.recebe_comunicacoes !== false ? '1' : '0'
          break
        case 'observacoes':
          valA = a.observacoes || ''
          valB = b.observacoes || ''
          break
        case 'updated':
          valA = a.updated || a.created
          valB = b.updated || b.created
          break
        default:
          valA = a.nome
          valB = b.nome
      }

      const cmp = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base', numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [
    filteredContatos,
    sortField,
    sortDir,
    revendaMap,
    insideSalesMap,
    responsavelMap,
    canalFaturamentoMap,
    segmentoMap,
    cargoMap,
    estadoMap,
  ])

  // Estrutura de Grupo Genérica (Inside Sales, Responsável ou Revenda)
  interface ContatosGroup {
    groupId: string
    groupTitle: string
    subTitle?: string
    badgeText?: string
    detailInfo?: string
    linkTo?: string
    distinctRevendasCount: number
    contatos: Contato[]
    isUnassigned?: boolean
  }

  // Lista paginada para o modo Lista Plana
  const paginatedContatos = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return sortedContatos.slice(start, start + perPage)
  }, [sortedContatos, currentPage, perPage])

  // Todos os grupos formados conforme a opção groupBy
  const allGroups = useMemo(() => {
    if (groupBy === 'none') return []

    const groups: ContatosGroup[] = []
    const groupMap = new Map<string, ContatosGroup>()
    const revendasPerGroup = new Map<string, Set<string>>()

    for (const contato of sortedContatos) {
      const info = getContatoRevendaInfo(contato)
      let gId = ''
      let gTitle = ''
      let subTitle: string | undefined = undefined
      let badgeText: string | undefined = undefined
      let detailInfo: string | undefined = undefined
      let linkTo: string | undefined = undefined
      let isUnassigned = false

      if (groupBy === 'inside_sales') {
        if (info.insideSalesId) {
          gId = info.insideSalesId
          gTitle = info.insideSalesNome || 'Inside Sales não identificado'
        } else {
          gId = 'sem_inside_sales'
          gTitle = 'Sem Inside Sales Definido'
          isUnassigned = true
        }
        badgeText = 'Inside Sales'
      } else if (groupBy === 'responsavel') {
        if (info.responsavelId) {
          gId = info.responsavelId
          gTitle = info.responsavelNome || 'Responsável não identificado'
        } else {
          gId = 'sem_responsavel'
          gTitle = 'Sem Responsável Comercial Definido'
          isUnassigned = true
        }
        badgeText = 'Responsável Comercial'
      } else {
        // 'revenda'
        gId = info.revendaId
        if (info.revendaId === 'sem_revenda' || !info.rev) {
          gTitle = 'Contatos sem Revenda Vinculada'
          isUnassigned = true
        } else {
          gTitle = info.revendaNome
          subTitle = info.revendaCodigo ? `Cód: ${info.revendaCodigo}` : undefined
          badgeText = info.segmentoNome || undefined
          detailInfo = [info.revendaCidade, info.estadoUf].filter(Boolean).join(' / ') || undefined
          linkTo = `/revendas/${info.revendaId}`
        }
      }

      let grp = groupMap.get(gId)
      if (!grp) {
        grp = {
          groupId: gId,
          groupTitle: gTitle,
          subTitle,
          badgeText,
          detailInfo,
          linkTo,
          distinctRevendasCount: 0,
          contatos: [],
          isUnassigned,
        }
        groupMap.set(gId, grp)
        groups.push(grp)
        revendasPerGroup.set(gId, new Set<string>())
      }

      grp.contatos.push(contato)
      if (contato.revenda) {
        revendasPerGroup.get(gId)?.add(contato.revenda)
      }
    }

    // Atualiza distinctRevendasCount para cada grupo
    for (const grp of groups) {
      grp.distinctRevendasCount = revendasPerGroup.get(grp.groupId)?.size || 0
    }

    return groups
  }, [
    sortedContatos,
    groupBy,
    revendaMap,
    insideSalesMap,
    responsavelMap,
    canalFaturamentoMap,
    segmentoMap,
    cargoMap,
    estadoMap,
  ])

  // Grupos exibidos na página atual no modo agrupado
  const displayedGroups = useMemo(() => {
    if (groupsPerPage === 'all') {
      return allGroups
    }
    const start = (groupPage - 1) * groupsPerPage
    return allGroups.slice(start, start + groupsPerPage)
  }, [allGroups, groupPage, groupsPerPage])

  // Total de contatos contidos nos grupos atualmente visíveis na tela
  const totalContatosVisiveisNoAgrupado = useMemo(() => {
    return displayedGroups.reduce((acc, g) => acc + g.contatos.length, 0)
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
    // Ao colapsar todas, muda a paginação para exibir TODOS os grupos em uma única página,
    // conforme o comportamento consolidado na rodada 0.0.27
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

  // Paginação da lista plana
  const totalPages = Math.ceil(sortedContatos.length / perPage) || 1

  // Paginação dos grupos
  const totalGroupPages =
    groupsPerPage === 'all' ? 1 : Math.ceil(allGroups.length / groupsPerPage) || 1

  const handleSort = (field: ContatoSortField) => {
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
    const dataToExport = sortedContatos.map((c) => {
      const info = getContatoRevendaInfo(c)
      return {
        inside_sales: info.insideSalesNome,
        faturamento: info.canalFaturamentoNome,
        revenda: info.revendaNome,
        codigo_revenda: info.revendaCodigo,
        nome: c.nome,
        telefones: [c.telefone, c.celular, c.whatsapp].filter(Boolean).join(' / '),
        email: c.email || '',
        email_secundario: c.email_secundario || '',
        cargo: info.cargoNome,
        segmento: info.segmentoNome,
        estado: info.estadoUf,
        cidade: info.cidade,
        contato_principal: c.contato_principal ? 'Sim' : 'Não',
        recebe_comunicacoes: c.recebe_comunicacoes !== false ? 'Sim' : 'Não',
        status: c.status_contato || 'Ativo',
        observacoes: c.observacoes || '',
      }
    })

    exportToCSV('contatos_relatorio', dataToExport, [
      { key: 'inside_sales', label: 'Inside Sales' },
      { key: 'faturamento', label: 'Faturamento' },
      { key: 'revenda', label: 'Revenda' },
      { key: 'codigo_revenda', label: 'Código Revenda' },
      { key: 'nome', label: 'Nome do Contato' },
      { key: 'telefones', label: 'Telefones' },
      { key: 'email', label: 'E-MAIL' },
      { key: 'email_secundario', label: 'E-mail Secundário' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'segmento', label: 'Segmento' },
      { key: 'estado', label: 'UF' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'contato_principal', label: 'Contato Principal' },
      { key: 'recebe_comunicacoes', label: 'Recebe Comunicações' },
      { key: 'status', label: 'Status' },
      { key: 'observacoes', label: 'Observações' },
    ])
  }

  const limparFiltros = () => {
    startTransition(() => {
      setSearchGeral('')
      setFilterSegmento('all')
      setFilterRevenda('all')
      setFilterCargo('all')
      setFilterInsideSales('all')
      setFilterResponsavel('all')
      setFilterCanal('all')
      setFilterStatus('all')
      setFilterPrincipal('all')
      setFilterComunicacoes('all')
      setCurrentPage(1)
      setGroupPage(1)
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

      {/* CARDS / CHIPS DE RESUMO POR SEGMENTO (QUANTIDADE POR REVENDAS DISTINTAS) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Revendas por Segmento
            </span>
            <span className="text-[11px] text-slate-500 font-normal">
              (Totaliza a quantidade de revendas distintas em cada segmento)
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Total na base:{' '}
            <span className="font-bold text-slate-900">
              {statsRevendasPorSegmento.totalGeralRevendas} revendas
            </span>
            <span className="text-slate-300 mx-1.5">|</span>
            <span className="font-bold text-slate-900">{contatos.length} contatos</span>
          </div>
        </div>

        {/* Chips clicáveis de filtro rápido por segmento */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setFilterSegmento('all')
              setCurrentPage(1)
              setGroupPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterSegmento === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-600 ring-offset-1'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Todos os segmentos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filterSegmento === 'all'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {statsRevendasPorSegmento.totalGeralRevendas} revendas
            </span>
          </button>

          {statsRevendasPorSegmento.items.map((seg) => {
            const isSelected = filterSegmento === seg.id
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => {
                  setFilterSegmento(isSelected ? 'all' : seg.id)
                  setCurrentPage(1)
                  setGroupPage(1)
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-600 ring-offset-1'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <span>{seg.nome}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  {seg.totalRevendas} {seg.totalRevendas === 1 ? 'revenda' : 'revendas'}
                </span>
              </button>
            )
          })}

          {statsRevendasPorSegmento.semSegmento > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterSegmento(filterSegmento === 'sem_segmento' ? 'all' : 'sem_segmento')
                setCurrentPage(1)
                setGroupPage(1)
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterSegmento === 'sem_segmento'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600 ring-offset-1'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100/80'
              }`}
            >
              <span>Sem segmento definido</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filterSegmento === 'sem_segmento'
                    ? 'bg-amber-700 text-white'
                    : 'bg-white text-amber-800 border border-amber-200'
                }`}
              >
                {statsRevendasPorSegmento.semSegmento}
              </span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          {/* Busca Geral */}
          <div className="sm:col-span-2">
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
                  setGroupPage(1)
                }}
                placeholder="Nome, e-mail, tel, revenda, IS, faturamento..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Inside Sales */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Inside Sales
            </label>
            <select
              value={filterInsideSales}
              onChange={(e) => {
                setFilterInsideSales(e.target.value)
                setCurrentPage(1)
                setGroupPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Inside Sales</option>
              {insideSalesList.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Faturamento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Faturamento
            </label>
            <select
              value={filterCanal}
              onChange={(e) => {
                setFilterCanal(e.target.value)
                setCurrentPage(1)
                setGroupPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Canais</option>
              {canaisFaturamentoList.map((can) => (
                <option key={can.id} value={can.id}>
                  {can.nome}
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
                setGroupPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Responsáveis</option>
              {responsaveisList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Segmento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Segmento</label>
            <select
              value={filterSegmento}
              onChange={(e) => {
                setFilterSegmento(e.target.value)
                setCurrentPage(1)
                setGroupPage(1)
              }}
              className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os segmentos</option>
              {segmentos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
              <option value="sem_segmento">Sem segmento</option>
            </select>
          </div>

          {/* Revenda */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revenda</label>
            <select
              value={filterRevenda}
              onChange={(e) => {
                setFilterRevenda(e.target.value)
                setCurrentPage(1)
                setGroupPage(1)
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
                setGroupPage(1)
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
        </div>
      </div>

      {/* CONTROLE DE AGRUPAMENTO (INSIDE SALES, RESPONSÁVEL, REVENDA OU LISTA PLANA) E EXPANDIR/COLAPSAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-700 whitespace-nowrap">Agrupar por:</span>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupByOption)
                setGroupPage(1)
                setCollapsedGroups({})
              }}
              className="py-1 px-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Sem agrupamento (Lista Plana)</option>
              <option value="inside_sales">Inside Sales</option>
              <option value="responsavel">Responsável Comercial</option>
              <option value="revenda">Revenda</option>
            </select>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <span className="text-slate-500">
            {groupBy !== 'none' ? (
              <>
                {groupsPerPage === 'all' ? (
                  <>
                    Exibindo todos os <strong className="text-slate-800">{allGroups.length}</strong>{' '}
                    {groupBy === 'inside_sales'
                      ? 'grupos de Inside Sales'
                      : groupBy === 'responsavel'
                        ? 'grupos de Responsáveis'
                        : 'grupos de revendas'}{' '}
                    nesta página (
                    <strong className="text-slate-800">{sortedContatos.length}</strong> contatos)
                  </>
                ) : (
                  <>
                    <strong className="text-slate-800">{displayedGroups.length}</strong> de{' '}
                    <strong className="text-slate-800">{allGroups.length}</strong> grupos nesta
                    página ({totalContatosVisiveisNoAgrupado} contatos visíveis)
                  </>
                )}
              </>
            ) : (
              <>
                Modo lista plana:{' '}
                <strong className="text-slate-800">{sortedContatos.length}</strong> contatos
                filtrados
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

      {/* TABELA DE CONTATOS / RELATÓRIO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-10 text-center">Princ.</th>
                <th
                  onClick={() => handleSort('inside_sales')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Inside Sales"
                >
                  <div className="flex items-center gap-1">
                    <span>Inside Sales</span>
                    {sortField === 'inside_sales' ? (
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
                  onClick={() => handleSort('faturamento')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Canal de Faturamento"
                >
                  <div className="flex items-center gap-1">
                    <span>Faturamento</span>
                    {sortField === 'faturamento' ? (
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
                <th
                  onClick={() => handleSort('nome')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Nome do Contato"
                >
                  <div className="flex items-center gap-1">
                    <span>Nome do Contato</span>
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
                  onClick={() => handleSort('telefone')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Telefones"
                >
                  <div className="flex items-center gap-1">
                    <span>Telefones</span>
                    {sortField === 'telefone' ? (
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
                  onClick={() => handleSort('email')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por E-mail"
                >
                  <div className="flex items-center gap-1">
                    <span>E-MAIL</span>
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
                <th
                  onClick={() => handleSort('cargo')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Cargo"
                >
                  <div className="flex items-center gap-1">
                    <span>Cargo</span>
                    {sortField === 'cargo' ? (
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
                  onClick={() => handleSort('segmento')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por Segmento"
                >
                  <div className="flex items-center gap-1">
                    <span>Segmento</span>
                    {sortField === 'segmento' ? (
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
                  onClick={() => handleSort('estado_cidade')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Ordenar por UF / Cidade"
                >
                  <div className="flex items-center gap-1">
                    <span>UF / Cidade</span>
                    {sortField === 'estado_cidade' ? (
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
                  onClick={() => handleSort('recebe_comunicacoes')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
                  title="Recebe comunicações de e-mail"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Comunic.</span>
                    {sortField === 'recebe_comunicacoes' ? (
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
                {canWrite && <th className="py-3 px-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Carregando base de contatos...</span>
                  </td>
                </tr>
              ) : sortedContatos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>Nenhum contato encontrado.</span>
                  </td>
                </tr>
              ) : groupBy === 'none' ? (
                // MODO PLANO (SEM AGRUPAMENTO)
                paginatedContatos.map((c) => {
                  const info = getContatoRevendaInfo(c)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Estrela contato principal */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePrincipal(c)}
                          disabled={!canWrite}
                          title={
                            c.contato_principal ? 'Contato Principal' : 'Marcar como Principal'
                          }
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

                      {/* 1. Inside Sales */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {info.insideSalesNome ? (
                          <span className="font-medium text-slate-800">{info.insideSalesNome}</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 2. Faturamento */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {info.canalFaturamentoNome ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {info.canalFaturamentoNome}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 3. Revenda */}
                      <td className="py-3 px-3">
                        {info.rev ? (
                          <div>
                            <Link
                              to={`/revendas/${info.rev.id}`}
                              className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              <span>{info.rev.nome}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            {info.rev.codigo && (
                              <div className="mt-0.5">
                                <span className="font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                  Cód: {info.rev.codigo}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 4. Nome do Contato */}
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {c.nome}
                      </td>

                      {/* 5. Telefones */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                        {[c.telefone, c.celular, c.whatsapp].filter(Boolean).join(' / ') || '—'}
                      </td>

                      {/* 6. E-MAIL */}
                      <td className="py-3 px-3">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="text-blue-700 hover:underline font-medium break-all"
                          >
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Sem e-mail</span>
                        )}
                        {c.email_secundario && (
                          <span className="block text-[11px] text-slate-400 break-all">
                            {c.email_secundario}
                          </span>
                        )}
                      </td>

                      {/* 7. Cargo */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {info.cargoNome || '—'}
                        </span>
                      </td>

                      {/* 8. Segmento */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {info.segmentoNome ? (
                          <span className="text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {info.segmentoNome}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 9. UF / Cidade */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                        {[info.estadoUf, info.cidade].filter(Boolean).join(' / ') || '—'}
                      </td>

                      {/* 10. Recebe Comunicações */}
                      <td className="py-3 px-3 text-center">
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

                      {/* 11. Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
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
                        <td className="py-3 px-3 text-right whitespace-nowrap">
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
                  )
                })
              ) : (
                // MODO AGRUPADO COLAPSÁVEL (INSIDE SALES, RESPONSÁVEL OU REVENDA)
                displayedGroups.map((group) => {
                  const isCollapsed = !!collapsedGroups[group.groupId]
                  return (
                    <React.Fragment key={`group-${group.groupId}`}>
                      {/* CABEÇALHO DO GRUPO */}
                      <tr className="bg-slate-100/90 border-y border-slate-200 hover:bg-slate-200/70 transition-colors">
                        <td colSpan={13} className="py-2.5 px-3">
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
                                {groupBy === 'inside_sales' && (
                                  <Users className="h-4 w-4 text-blue-600" />
                                )}
                                {groupBy === 'responsavel' && (
                                  <UserCheck className="h-4 w-4 text-emerald-600" />
                                )}
                                {groupBy === 'revenda' && (
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

                                {group.detailInfo && (
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    {group.detailInfo}
                                  </span>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-2.5">
                              {groupBy !== 'revenda' && (
                                <span className="text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                                  {group.distinctRevendasCount}{' '}
                                  {group.distinctRevendasCount === 1 ? 'revenda' : 'revendas'}
                                </span>
                              )}

                              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                                {group.contatos.length}{' '}
                                {group.contatos.length === 1 ? 'contato' : 'contatos'}
                              </span>

                              {group.linkTo && !group.isUnassigned && (
                                <Link
                                  to={group.linkTo}
                                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                                  title="Ver cadastro da revenda"
                                >
                                  <span>Abrir Revenda</span>
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* LINHAS DE CONTATOS DO GRUPO (QUANDO NÃO COLAPSADO) */}
                      {!isCollapsed &&
                        group.contatos.map((c) => {
                          const info = getContatoRevendaInfo(c)
                          return (
                            <tr
                              key={c.id}
                              className="hover:bg-slate-50/80 transition-colors bg-white"
                            >
                              {/* Estrela contato principal */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePrincipal(c)}
                                  disabled={!canWrite}
                                  title={
                                    c.contato_principal
                                      ? 'Contato Principal'
                                      : 'Marcar como Principal'
                                  }
                                  className={`p-1 rounded transition-colors ${
                                    c.contato_principal
                                      ? 'text-amber-500 hover:text-amber-600'
                                      : 'text-slate-300 hover:text-slate-400'
                                  }`}
                                >
                                  <Star
                                    className={`h-4 w-4 ${
                                      c.contato_principal ? 'fill-amber-400' : ''
                                    }`}
                                  />
                                </button>
                              </td>

                              {/* 1. Inside Sales */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {info.insideSalesNome ? (
                                  <span className="font-medium text-slate-800">
                                    {info.insideSalesNome}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">—</span>
                                )}
                              </td>

                              {/* 2. Faturamento */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {info.canalFaturamentoNome ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {info.canalFaturamentoNome}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">—</span>
                                )}
                              </td>

                              {/* 3. Revenda */}
                              <td className="py-2.5 px-3">
                                {info.rev ? (
                                  <div>
                                    <Link
                                      to={`/revendas/${info.rev.id}`}
                                      className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>{info.rev.nome}</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                    {info.rev.codigo && (
                                      <div className="mt-0.5">
                                        <span className="font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                          Cód: {info.rev.codigo}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* 4. Nome do Contato */}
                              <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                  <span>{c.nome}</span>
                                </div>
                              </td>

                              {/* 5. Telefones */}
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                                {[c.telefone, c.celular, c.whatsapp].filter(Boolean).join(' / ') ||
                                  '—'}
                              </td>

                              {/* 6. E-MAIL */}
                              <td className="py-2.5 px-3">
                                {c.email ? (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="text-blue-700 hover:underline font-medium break-all"
                                  >
                                    {c.email}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">Sem e-mail</span>
                                )}
                                {c.email_secundario && (
                                  <span className="block text-[11px] text-slate-400 break-all">
                                    {c.email_secundario}
                                  </span>
                                )}
                              </td>

                              {/* 7. Cargo */}
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  {info.cargoNome || '—'}
                                </span>
                              </td>

                              {/* 8. Segmento */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {info.segmentoNome ? (
                                  <span className="text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                    {info.segmentoNome}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* 9. UF / Cidade */}
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                                {[info.estadoUf, info.cidade].filter(Boolean).join(' / ') || '—'}
                              </td>

                              {/* 10. Recebe Comunicações */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleComunicacoes(c)}
                                  disabled={!canWrite}
                                  title={
                                    c.recebe_comunicacoes !== false
                                      ? 'Recebe comunicações'
                                      : 'Não recebe'
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

                              {/* 11. Status */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
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
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
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
                          )
                        })}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

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
                      <strong>{sortedContatos.length}</strong> contatos no total)
                    </>
                  ) : (
                    <>
                      Exibindo grupos {(groupPage - 1) * groupsPerPage + 1}–
                      {Math.min(groupPage * groupsPerPage, allGroups.length)} de {allGroups.length}{' '}
                      ({totalContatosVisiveisNoAgrupado} contatos visíveis de{' '}
                      {sortedContatos.length} no total)
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
              // Paginação por Contato no modo Lista Plana
              <>
                <span>
                  Exibindo {sortedContatos.length === 0 ? 0 : (currentPage - 1) * perPage + 1} até{' '}
                  {Math.min(currentPage * perPage, sortedContatos.length)} de{' '}
                  {sortedContatos.length} contatos
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
              groupsPerPage === 'all' ? (
                <span className="px-2 font-medium text-slate-700 bg-slate-100 py-1 rounded">
                  Página única (todos os {allGroups.length} grupos)
                </span>
              ) : (
                <>
                  <button
                    onClick={() => setGroupPage((p) => Math.max(1, p - 1))}
                    disabled={groupPage === 1}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-medium text-slate-700">
                    Página {groupPage} de {totalGroupPages}
                  </span>
                  <button
                    onClick={() => setGroupPage((p) => Math.min(totalGroupPages, p + 1))}
                    disabled={groupPage === totalGroupPages}
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
