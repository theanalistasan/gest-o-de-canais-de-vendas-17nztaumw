import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Table,
  Plus,
  Trash2,
} from 'lucide-react'
import { parseCSVString } from '@/lib/csvParser'
import {
  auxiliaresService,
  revendasService,
  contatosService,
  adminService,
} from '@/services/apiService'
import pb from '@/lib/pocketbase/client'

interface FieldMapping {
  segmento: number // índice da coluna no arquivo
  codigo: number
  revenda: number
  nomeContato: number
  insideSales: number
  canalFaturamento: number
  responsavel: number
  cargo: number
  estado: number
  cidade: number
  email: number
  telefone: number
}

interface ProcessedContatoItem {
  nome: string
  cargo?: string
  email?: string
  emailSecundario?: string
  telefone?: string
  isPrincipal: boolean
  issues: string[]
  existingId?: string
  isExisting?: boolean
}

interface ProcessedRevendaGroup {
  codigo?: string
  nome: string
  segmento: string
  insideSales?: string
  canalFaturamento?: string
  responsavel?: string
  estado?: string
  cidade?: string
  existingId?: string
  isExisting?: boolean
  contatos: ProcessedContatoItem[]
  issues: string[]
}

export const ImportWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Etapa 1: Arquivo e Preview
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [isReadingFile, setIsReadingFile] = useState(false)

  // Etapa 2: Mapeamento
  const [mapping, setMapping] = useState<FieldMapping>({
    segmento: -1,
    codigo: -1,
    revenda: -1,
    nomeContato: -1,
    insideSales: -1,
    canalFaturamento: -1,
    responsavel: -1,
    cargo: -1,
    estado: -1,
    cidade: -1,
    email: -1,
    telefone: -1,
  })

  // Etapa 3: Regras e Sinônimos
  const [separateMultipleEmails, setSeparateMultipleEmails] = useState(true)
  const [validateEmailFormat, setValidateEmailFormat] = useState(true)
  const [synonyms, setSynonyms] = useState<Array<{ from: string; to: string }>>([
    { from: 'DONA', to: 'DONO' },
    { from: 'VENDEDORA', to: 'VENDEDOR' },
    { from: 'GERENTE REVENDA', to: 'GERENTE' },
    { from: 'COMPRADOR', to: 'COMPRAS' },
  ])
  const [newSynFrom, setNewSynFrom] = useState('')
  const [newSynTo, setNewSynTo] = useState('')

  // Etapa 4: Validação em memória
  const [isValidatingDb, setIsValidatingDb] = useState(false)
  const [processedGroups, setProcessedGroups] = useState<ProcessedRevendaGroup[]>([])
  const [validationSummary, setValidationSummary] = useState({
    totalRevendas: 0,
    revendasExistentes: 0,
    totalContatos: 0,
    contatosExistentes: 0,
    contatosSemEmail: 0,
    emailsInvalidos: 0,
    codigosDuplicados: 0,
    nomesIguaisInsideSales: 0,
  })

  // Etapa 5: Execução
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importStatusText, setImportStatusText] = useState('')
  const [importCompleted, setImportCompleted] = useState(false)
  const [importReport, setImportReport] = useState({
    revendasCriadas: 0,
    revendasAtualizadas: 0,
    contatosCriados: 0,
    contatosAtualizados: 0,
    auxiliaresCriadas: 0,
    descartados: 0,
  })

  // ETAPA 1: Processar arquivo no cliente
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setFileSize((file.size / 1024).toFixed(1) + ' KB')
    setIsReadingFile(true)

    const reader = new FileReader()

    // Como o arquivo XLSX original é um zip de XMLs, tentar ler texto plano se for CSV/TSV,
    // ou se o usuário exportou para CSV. Para arquivos .xlsx/xls, também tratamos de forma tolerante:
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || ''
        const parsed = parseCSVString(text)

        if (parsed.headers.length === 0) {
          // Se for binário puro não-CSV
          alert(
            'Para importação imediata no navegador, envie a planilha salva no formato CSV (.csv) com colunas separadas por vírgula ou ponto-e-vírgula.',
          )
          setIsReadingFile(false)
          return
        }

        setRawHeaders(parsed.headers)
        setRawRows(parsed.rows)

        // Auto-detectar colunas por similaridade
        autoDetectMapping(parsed.headers)
        setCurrentStep(2)
      } catch (err) {
        console.error('Falha ao processar arquivo:', err)
        alert('Erro ao interpretar o arquivo. Certifique-se de salvar em formato CSV.')
      } finally {
        setIsReadingFile(false)
      }
    }

    reader.onerror = () => {
      alert('Não foi possível ler o arquivo.')
      setIsReadingFile(false)
    }

    reader.readAsText(file, 'utf-8')
  }

  const autoDetectMapping = (headers: string[]) => {
    const map: FieldMapping = {
      segmento: -1,
      codigo: -1,
      revenda: -1,
      nomeContato: -1,
      insideSales: -1,
      canalFaturamento: -1,
      responsavel: -1,
      cargo: -1,
      estado: -1,
      cidade: -1,
      email: -1,
      telefone: -1,
    }

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().trim()

      // 1. Inside Sales — deve ter prioridade máxima para nunca ser capturado como 'nome' ou 'contato'
      if (lower.includes('inside') || lower.includes('sales') || lower === 'is') {
        map.insideSales = idx
      }
      // 2. Segmento
      else if (lower.includes('segment') || lower.includes('seguim')) {
        map.segmento = idx
      }
      // 3. Código da Revenda
      else if (lower === 'cod' || lower.includes('código') || lower.includes('codigo')) {
        map.codigo = idx
      }
      // 4. Revenda (Razão Social / Nome Fantasia)
      else if (
        lower === 'revenda' ||
        lower.includes('revenda') ||
        lower.includes('razão') ||
        lower.includes('razao') ||
        lower.includes('fantasia')
      ) {
        map.revenda = idx
      }
      // 5. Canal Faturamento
      else if (lower.includes('canal') || lower.includes('faturamento')) {
        map.canalFaturamento = idx
      }
      // 6. Responsável Comercial
      else if (
        lower.includes('responsável') ||
        lower.includes('responsavel') ||
        lower === 'resp' ||
        lower === 'rc'
      ) {
        map.responsavel = idx
      }
      // 7. Cargo / Função
      else if (lower.includes('cargo') || lower.includes('função') || lower.includes('funcao')) {
        map.cargo = idx
      }
      // 8. Estado / UF
      else if (lower.includes('estado') || lower === 'uf') {
        map.estado = idx
      }
      // 9. Cidade / Município
      else if (lower.includes('cidade') || lower.includes('munic')) {
        map.cidade = idx
      }
      // 10. E-mail
      else if (lower.includes('mail') || lower.includes('e-mail')) {
        map.email = idx
      }
      // 11. Telefone / Celular / Whatsapp
      else if (
        lower.includes('tel') ||
        lower.includes('cel') ||
        lower.includes('fone') ||
        lower.includes('whats')
      ) {
        map.telefone = idx
      }
      // 12. Nome do Contato (somente colunas de contato ou nome que não sejam revenda/inside sales)
      else if (
        lower.includes('contato') ||
        lower === 'nome' ||
        lower.includes('nome do contato') ||
        lower.includes('nome contato')
      ) {
        map.nomeContato = idx
      }
    })

    setMapping(map)
  }

  const normalizeText = (text?: string): string => {
    if (!text) return ''
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ETAPA 3 -> 4: Agrupamento em memória e checagem com o banco de dados contra duplicidade
  const handleProcessAndValidate = async () => {
    setIsValidatingDb(true)
    try {
      const groups: ProcessedRevendaGroup[] = []
      let currentGroup: ProcessedRevendaGroup | null = null

      let semEmail = 0
      let emailsInv = 0
      const codigosSeen = new Set<string>()
      let dupCodigos = 0

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]

        const rawCodigo = mapping.codigo >= 0 ? (row[mapping.codigo] || '').trim() : ''
        const rawRevenda = mapping.revenda >= 0 ? (row[mapping.revenda] || '').trim() : ''
        const rawSegmento = mapping.segmento >= 0 ? (row[mapping.segmento] || '').trim() : ''
        const rawInside = mapping.insideSales >= 0 ? (row[mapping.insideSales] || '').trim() : ''
        const rawCanal =
          mapping.canalFaturamento >= 0 ? (row[mapping.canalFaturamento] || '').trim() : ''
        const rawResp = mapping.responsavel >= 0 ? (row[mapping.responsavel] || '').trim() : ''
        const rawEstado = mapping.estado >= 0 ? (row[mapping.estado] || '').trim() : ''
        const rawCidade = mapping.cidade >= 0 ? (row[mapping.cidade] || '').trim() : ''

        const rawNomeContato =
          mapping.nomeContato >= 0 ? (row[mapping.nomeContato] || '').trim() : ''
        let rawCargo = mapping.cargo >= 0 ? (row[mapping.cargo] || '').trim() : ''
        const rawEmail = mapping.email >= 0 ? (row[mapping.email] || '').trim() : ''
        const rawTel = mapping.telefone >= 0 ? (row[mapping.telefone] || '').trim() : ''

        // Padronização de cargos por sinônimos
        if (rawCargo) {
          for (const syn of synonyms) {
            if (rawCargo.toUpperCase() === syn.from.toUpperCase()) {
              rawCargo = syn.to
              break
            }
          }
        }

        // Tratar e-mails múltiplos
        let primaryEmail = rawEmail
        let secondaryEmail = ''
        if (separateMultipleEmails && rawEmail) {
          const parts = rawEmail
            .split(/;|\/|,/)
            .map((p) => p.trim())
            .filter(Boolean)
          if (parts.length > 0) primaryEmail = parts[0]
          if (parts.length > 1) secondaryEmail = parts[1]
        }

        // Validação de e-mail
        const emailIssues: string[] = []
        if (!primaryEmail) {
          semEmail++
          emailIssues.push('Contato sem e-mail')
        } else if (
          validateEmailFormat &&
          (!primaryEmail.includes('@') || !primaryEmail.includes('.'))
        ) {
          emailsInv++
          emailIssues.push('Formato de e-mail inválido')
        }

        // É uma nova revenda ou uma linha de contato filho?
        const isNewRevendaLine =
          !!rawCodigo || (!!rawRevenda && (!currentGroup || rawRevenda !== currentGroup.nome))

        if (isNewRevendaLine) {
          if (currentGroup) {
            groups.push(currentGroup)
          }

          const revendaIssues: string[] = []
          if (!rawRevenda && !rawCodigo) {
            revendaIssues.push('Revenda sem nome e sem código')
          }
          if (rawCodigo) {
            if (codigosSeen.has(rawCodigo)) {
              dupCodigos++
              revendaIssues.push(`Código duplicado: ${rawCodigo}`)
            } else {
              codigosSeen.add(rawCodigo)
            }
          }

          currentGroup = {
            codigo: rawCodigo || undefined,
            nome: rawRevenda || `Revenda ${rawCodigo || groups.length + 1}`,
            segmento: rawSegmento || 'DIGITAL PRINTING (DP)',
            insideSales: rawInside || undefined,
            canalFaturamento: rawCanal || undefined,
            responsavel: rawResp || undefined,
            estado: rawEstado || undefined,
            cidade: rawCidade || undefined,
            contatos: [],
            issues: revendaIssues,
          }
        }

        // Se há nome de contato nesta linha, adiciona ao grupo atual
        if (currentGroup && (rawNomeContato || primaryEmail)) {
          const contatoIssues = [...emailIssues]
          // Validação: verificar se o nome do contato é idêntico ao inside sales da revenda
          if (
            rawNomeContato &&
            currentGroup.insideSales &&
            normalizeText(rawNomeContato) === normalizeText(currentGroup.insideSales)
          ) {
            contatoIssues.push(
              `Atenção: Nome do contato é idêntico ao Inside Sales (${currentGroup.insideSales})`,
            )
          }

          currentGroup.contatos.push({
            nome: rawNomeContato || 'Contato sem nome',
            cargo: rawCargo || undefined,
            email: primaryEmail || undefined,
            emailSecundario: secondaryEmail || undefined,
            telefone: rawTel || undefined,
            isPrincipal: currentGroup.contatos.length === 0, // Primeiro contato é o principal
            issues: contatoIssues,
          })
        }
      }

      if (currentGroup) {
        groups.push(currentGroup)
      }

      // Buscar revendas e contatos existentes do backend para verificar duplicatas
      const [existingRevendas, existingContatos] = await Promise.all([
        revendasService.getAll(),
        contatosService.getAll(),
      ])

      // Mapa de revendas existentes por código normalizado e por nome normalizado
      const revByCodigo = new Map<string, (typeof existingRevendas)[0]>()
      const revByNome = new Map<string, (typeof existingRevendas)[0]>()
      for (const r of existingRevendas) {
        if (r.codigo) revByCodigo.set(normalizeText(r.codigo), r)
        if (r.nome) revByNome.set(normalizeText(r.nome), r)
      }

      // Mapa de contatos existentes por chave composta: nomeNorm|||revendaId|||emailNorm
      // Também chave sem email: nomeNorm|||revendaId|||
      const contatosByFullKey = new Map<string, (typeof existingContatos)[0]>()
      for (const c of existingContatos) {
        const cNome = normalizeText(c.nome)
        const cRevId = c.revenda || ''
        const cEmail = normalizeText(c.email)
        contatosByFullKey.set(`${cNome}|||${cRevId}|||${cEmail}`, c)
        if (cEmail) {
          // Também indexar por email|||revId caso queira conferência cruzada
          contatosByFullKey.set(`*|||${cRevId}|||${cEmail}`, c)
        }
      }

      let revExistentesCount = 0
      let contExistentesCount = 0

      for (const g of groups) {
        let matchedRev = g.codigo ? revByCodigo.get(normalizeText(g.codigo)) : undefined
        if (!matchedRev && g.nome) {
          matchedRev = revByNome.get(normalizeText(g.nome))
        }

        if (matchedRev) {
          g.existingId = matchedRev.id
          g.isExisting = true
          revExistentesCount++
        }

        const revIdForMatch = matchedRev ? matchedRev.id : ''

        for (const c of g.contatos) {
          const cNome = normalizeText(c.nome)
          const cEmail = normalizeText(c.email)

          let matchedContato = revIdForMatch
            ? contatosByFullKey.get(`${cNome}|||${revIdForMatch}|||${cEmail}`)
            : undefined

          if (!matchedContato && revIdForMatch && cEmail) {
            matchedContato = contatosByFullKey.get(`*|||${revIdForMatch}|||${cEmail}`)
          }

          if (matchedContato) {
            c.existingId = matchedContato.id
            c.isExisting = true
            contExistentesCount++
          }
        }
      }

      const totalConts = groups.reduce((acc, g) => acc + g.contatos.length, 0)
      const nomesIguaisInsideCount = groups.reduce(
        (acc, g) =>
          acc +
          g.contatos.filter((c) => c.issues.some((iss) => iss.includes('idêntico ao Inside Sales')))
            .length,
        0,
      )

      setProcessedGroups(groups)
      setValidationSummary({
        totalRevendas: groups.length,
        revendasExistentes: revExistentesCount,
        totalContatos: totalConts,
        contatosExistentes: contExistentesCount,
        contatosSemEmail: semEmail,
        emailsInvalidos: emailsInv,
        codigosDuplicados: dupCodigos,
        nomesIguaisInsideSales: nomesIguaisInsideCount,
      })

      setCurrentStep(4)
    } catch (err) {
      console.error('Erro na validação do banco:', err)
      alert('Erro ao validar dados contra o banco de dados.')
    } finally {
      setIsValidatingDb(false)
    }
  }

  // ETAPA 5: Gravar tudo no PocketBase com Blindagem contra Duplicatas (Upsert / Merge)
  const handleExecuteImport = async () => {
    setIsImporting(true)
    setImportProgress(0)
    setImportStatusText('Iniciando processamento no backend...')

    let revCriadas = 0
    let revAtualizadas = 0
    let contCriados = 0
    let contAtualizados = 0
    let auxCriadas = 0

    try {
      // 1. Carregar ou criar auxiliares necessárias
      setImportStatusText('Sincronizando tabelas auxiliares (segmentos, estados, cargos)...')
      const [segs, stats, ins, resps, cans, cgs, ests] = await Promise.all([
        auxiliaresService.getSegmentos(),
        auxiliaresService.getStatusRevenda(),
        auxiliaresService.getInsideSales(),
        auxiliaresService.getResponsaveis(),
        auxiliaresService.getCanaisFaturamento(),
        auxiliaresService.getCargos(),
        auxiliaresService.getEstados(),
      ])

      const segMap = new Map<string, string>(segs.map((s) => [s.nome.toUpperCase(), s.id]))
      const statMap = new Map<string, string>(stats.map((s) => [s.nome.toUpperCase(), s.id]))
      const insideMap = new Map<string, string>(ins.map((i) => [i.nome.toUpperCase(), i.id]))
      const respMap = new Map<string, string>(resps.map((r) => [r.nome.toUpperCase(), r.id]))
      const canMap = new Map<string, string>(cans.map((c) => [c.nome.toUpperCase(), c.id]))
      const cgMap = new Map<string, string>(cgs.map((c) => [c.nome.toUpperCase(), c.id]))
      const estMap = new Map<string, string>(ests.map((e) => [e.nome.toUpperCase(), e.id]))

      // Status padrão "Ativa"
      let defaultStatusId = statMap.get('ATIVA') || stats[0]?.id
      if (!defaultStatusId) {
        const createdSt = await auxiliaresService.createItem('status_revenda', {
          nome: 'Ativa',
          cor: '#16A34A',
        })
        defaultStatusId = createdSt.id
        auxCriadas++
      }

      // Função auxiliar para obter ou criar item
      const getOrCreate = async (collection: string, name: string, map: Map<string, string>) => {
        if (!name) return undefined
        const key = name.trim().toUpperCase()
        if (map.has(key)) return map.get(key)

        try {
          const rec = await auxiliaresService.createItem(collection, { nome: name.trim() })
          map.set(key, rec.id)
          auxCriadas++
          return rec.id
        } catch (_) {
          return undefined
        }
      }

      // Carregar todas as revendas e contatos existentes do backend em tempo real para blindagem total
      setImportStatusText('Carregando base existente para cruzamento e prevenção de duplicidade...')
      const [dbRevendas, dbContatos] = await Promise.all([
        revendasService.getAll(),
        contatosService.getAll(),
      ])

      const revByCodigoMap = new Map<string, (typeof dbRevendas)[0]>()
      const revByNomeMap = new Map<string, (typeof dbRevendas)[0]>()
      for (const r of dbRevendas) {
        if (r.codigo) revByCodigoMap.set(normalizeText(r.codigo), r)
        if (r.nome) revByNomeMap.set(normalizeText(r.nome), r)
      }

      const contatosByFullKeyMap = new Map<string, (typeof dbContatos)[0]>()
      for (const c of dbContatos) {
        const cNome = normalizeText(c.nome)
        const cRevId = c.revenda || ''
        const cEmail = normalizeText(c.email)
        contatosByFullKeyMap.set(`${cNome}|||${cRevId}|||${cEmail}`, c)
        if (cEmail) {
          contatosByFullKeyMap.set(`*|||${cRevId}|||${cEmail}`, c)
        }
      }

      const total = processedGroups.length

      // 2. Criar ou atualizar cada revenda e seus contatos
      for (let i = 0; i < total; i++) {
        const g = processedGroups[i]
        setImportProgress(Math.round(((i + 1) / total) * 100))
        setImportStatusText(`Processando revenda ${i + 1} de ${total}: ${g.nome}...`)

        const segId = (await getOrCreate('segmentos', g.segmento, segMap)) || segs[0]?.id
        const insideId = g.insideSales
          ? await getOrCreate('inside_sales', g.insideSales, insideMap)
          : undefined
        const respId = g.responsavel
          ? await getOrCreate('responsaveis', g.responsavel, respMap)
          : undefined
        const canId = g.canalFaturamento
          ? await getOrCreate('canais_faturamento', g.canalFaturamento, canMap)
          : undefined

        let estadoId: string | undefined = undefined
        if (g.estado) {
          const estKey = g.estado.toUpperCase()
          if (estMap.has(estKey)) {
            estadoId = estMap.get(estKey)
          } else {
            // Tenta criar estado se não existir
            try {
              const newEst = await auxiliaresService.createItem('estados', {
                nome: g.estado,
                uf: g.estado.substring(0, 2).toUpperCase(),
              })
              estMap.set(estKey, newEst.id)
              estadoId = newEst.id
              auxCriadas++
            } catch {
              /* intentionally ignored */
            }
          }
        }

        // Verificar se revenda já existe por código normalizado ou nome
        let existingRev = g.codigo ? revByCodigoMap.get(normalizeText(g.codigo)) : undefined
        if (!existingRev && g.nome) {
          existingRev = revByNomeMap.get(normalizeText(g.nome))
        }

        let revendaRecordId = ''
        if (existingRev) {
          revendaRecordId = existingRev.id
          // Mesclar dados sem sobrescrever dados preenchidos com valores vazios
          const updatePayload: Record<string, any> = {
            nome: g.nome || existingRev.nome,
            segmento: segId || existingRev.segmento,
            inside_sales: insideId || existingRev.inside_sales,
            responsavel: respId || existingRev.responsavel,
            canal_faturamento: canId || existingRev.canal_faturamento,
            estado: estadoId || existingRev.estado,
            cidade: g.cidade || existingRev.cidade,
          }
          if (g.codigo && !existingRev.codigo) {
            updatePayload.codigo = g.codigo
          }
          await revendasService.update(existingRev.id, updatePayload)
          revAtualizadas++
        } else {
          const createdRev = await revendasService.create({
            codigo: g.codigo,
            nome: g.nome,
            segmento: segId,
            status: defaultStatusId,
            inside_sales: insideId,
            responsavel: respId,
            canal_faturamento: canId,
            estado: estadoId,
            cidade: g.cidade,
          })
          revendaRecordId = createdRev.id
          if (g.codigo) revByCodigoMap.set(normalizeText(g.codigo), createdRev)
          if (g.nome) revByNomeMap.set(normalizeText(g.nome), createdRev)
          revCriadas++
        }

        // 3. Criar ou mesclar contatos da revenda
        for (const c of g.contatos) {
          const cargoId = c.cargo ? await getOrCreate('cargos', c.cargo, cgMap) : undefined
          const cNomeNorm = normalizeText(c.nome)
          const cEmailNorm = normalizeText(c.email)

          // Buscar se já existe contato para esta revenda com mesmo nome e email normalizados
          let existingContact = contatosByFullKeyMap.get(
            `${cNomeNorm}|||${revendaRecordId}|||${cEmailNorm}`,
          )
          if (!existingContact && cEmailNorm) {
            existingContact = contatosByFullKeyMap.get(`*|||${revendaRecordId}|||${cEmailNorm}`)
          }

          if (existingContact) {
            // ATUALIZAR registro existente no modo mesclagem:
            // 1. Atualizar nome do contato se vier preenchido e diferente do existente
            //    (permite corrigir contatos cujo nome anterior foi importado incorretamente)
            const updateContatoPayload: Record<string, any> = {}

            if (
              c.nome &&
              c.nome.trim() !== '' &&
              c.nome.trim() !== '-' &&
              normalizeText(existingContact.nome) !== normalizeText(c.nome)
            ) {
              updateContatoPayload.nome = c.nome.trim()
            }

            // Preencher cargo se o existente não tiver ou se atualizado
            if (!existingContact.cargo && cargoId) {
              updateContatoPayload.cargo = cargoId
            }
            // Preencher email se o existente não tiver
            if (!existingContact.email && c.email) {
              updateContatoPayload.email = c.email
            }
            // Preencher email secundário se o existente não tiver
            if (!existingContact.email_secundario && c.emailSecundario) {
              updateContatoPayload.email_secundario = c.emailSecundario
            }
            // Preencher telefone se o existente não tiver
            if (!existingContact.telefone && c.telefone) {
              updateContatoPayload.telefone = c.telefone
            }
            // Manter ou marcar como principal
            if (!existingContact.contato_principal && c.isPrincipal) {
              updateContatoPayload.contato_principal = true
            }

            if (Object.keys(updateContatoPayload).length > 0) {
              await contatosService.update(existingContact.id, updateContatoPayload)
            }
            contAtualizados++
          } else {
            // CRIAR novo contato
            const createdContato = await contatosService.create({
              revenda: revendaRecordId,
              nome: c.nome,
              cargo: cargoId,
              email: c.email,
              email_secundario: c.emailSecundario,
              telefone: c.telefone,
              contato_principal: c.isPrincipal,
              recebe_comunicacoes: true,
              status_contato: 'Ativo',
            })
            contatosByFullKeyMap.set(
              `${cNomeNorm}|||${revendaRecordId}|||${cEmailNorm}`,
              createdContato,
            )
            if (cEmailNorm) {
              contatosByFullKeyMap.set(`*|||${revendaRecordId}|||${cEmailNorm}`, createdContato)
            }
            contCriados++
          }
        }
      }

      // 4. Registrar auditoria manual com ação IMPORTAR
      await adminService.recordManualAudit('IMPORTAR', `planilha/${fileName}`, {
        revendasCriadas: revCriadas,
        revendasAtualizadas: revAtualizadas,
        contatosCriados: contCriados,
        contatosAtualizados: contAtualizados,
        auxiliaresCriadas: auxCriadas,
        arquivo: fileName,
      })

      setImportReport({
        revendasCriadas: revCriadas,
        revendasAtualizadas: revAtualizadas,
        contatosCriados: contCriados,
        contatosAtualizados: contAtualizados,
        auxiliaresCriadas: auxCriadas,
        descartados: 0,
      })

      setImportCompleted(true)
      setImportStatusText('Importação concluída com sucesso!')
      setCurrentStep(5)
    } catch (err) {
      console.error('Erro na importação em lote:', err)
      alert('Ocorreu um erro durante a importação. Verifique o console.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleAddSynonym = () => {
    if (!newSynFrom.trim() || !newSynTo.trim()) return
    setSynonyms([...synonyms, { from: newSynFrom.trim(), to: newSynTo.trim() }])
    setNewSynFrom('')
    setNewSynTo('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <span>Assistente de Importação de Planilha</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Elimina o formato de linhas repetidas/vazias da planilha Excel e converte no modelo
          relacional (Revenda → Contatos).
        </p>

        {/* Stepper Wizard */}
        <div className="flex items-center gap-2 mt-4 text-xs font-semibold">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Mapeamento' },
            { num: 3, label: 'Regras' },
            { num: 4, label: 'Validação' },
            { num: 5, label: 'Conclusão' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  currentStep === s.num
                    ? 'bg-blue-600 text-white'
                    : currentStep > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </span>
              <span
                className={currentStep === s.num ? 'text-blue-600 font-bold' : 'text-slate-400'}
              >
                {s.label}
              </span>
              {s.num < 5 && <span className="text-slate-200">/</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ==================== ETAPA 1: UPLOAD ==================== */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50 hover:bg-blue-50/30 transition-all cursor-pointer relative">
            <input
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Arraste e solte o arquivo CSV ou clique para selecionar
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Formatos aceitos: <strong>.csv</strong> ou <strong>.tsv</strong> (separados por
              vírgula ou ponto-e-vírgula)
            </p>
            <p className="text-[11px] text-slate-400 mt-3">
              * O arquivo é lido inteiramente no seu navegador, sem envio direto do arquivo ao
              servidor.
            </p>
          </div>

          {isReadingFile && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Lendo e analisando linhas no navegador...</span>
            </div>
          )}
        </div>
      )}

      {/* ==================== ETAPA 2: MAPEAMENTO ==================== */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border">
            <div>
              Arquivo: <strong className="text-slate-800">{fileName}</strong> ({fileSize})
            </div>
            <div>{rawRows.length} linhas de dados detectadas</div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Mapeamento de Colunas do Arquivo para os Campos do Sistema
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[
              { key: 'codigo', label: 'Código da Revenda' },
              { key: 'revenda', label: 'Nome da Revenda *' },
              { key: 'segmento', label: 'Segmento' },
              { key: 'nomeContato', label: 'Nome do Contato' },
              { key: 'cargo', label: 'Cargo' },
              { key: 'email', label: 'E-mail' },
              { key: 'telefone', label: 'Telefone / Celular' },
              { key: 'insideSales', label: 'Inside Sales' },
              { key: 'canalFaturamento', label: 'Canal Faturamento' },
              { key: 'responsavel', label: 'Responsável' },
              { key: 'estado', label: 'Estado (UF)' },
              { key: 'cidade', label: 'Cidade' },
            ].map(({ key, label }) => {
              const fieldKey = key as keyof FieldMapping
              return (
                <div key={key} className="p-3 bg-slate-50 border rounded-lg">
                  <label className="block font-semibold text-slate-800 mb-1">{label}</label>
                  <select
                    value={mapping[fieldKey]}
                    onChange={(e) => setMapping({ ...mapping, [fieldKey]: Number(e.target.value) })}
                    className="w-full py-1.5 px-2 text-xs border rounded bg-white text-slate-700"
                  >
                    <option value={-1}>-- Ignorar / Não mapear --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h} (Col {idx + 1})
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Voltar
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
            >
              <span>Avançar para Regras</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================== ETAPA 3: REGRAS & PADRONIZAÇÃO ==================== */}
      {currentStep === 3 && (
        <div className="space-y-5 animate-in fade-in">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Regras de Normalização
            </h3>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={separateMultipleEmails}
                onChange={(e) => setSeparateMultipleEmails(e.target.checked)}
                className="mt-0.5 rounded text-blue-600"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">
                  Separar múltiplos e-mails por célula
                </span>
                <span className="text-slate-500">
                  Se a célula contiver mais de um endereço (ex.: separados por ponto-e-vírgula ou
                  barra), o primeiro vira o e-mail principal e o segundo o secundário.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={validateEmailFormat}
                onChange={(e) => setValidateEmailFormat(e.target.checked)}
                className="mt-0.5 rounded text-blue-600"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">
                  Detectar e sinalizar e-mails inválidos
                </span>
                <span className="text-slate-500">
                  Valida se os endereços possuem arroba e domínio para alerta preventivo antes do
                  envio de comunicados.
                </span>
              </div>
            </label>
          </div>

          {/* Tabela de Sinônimos de Cargo */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Padronização de Cargos (Sinônimos)
            </h3>
            <p className="text-xs text-slate-500">
              Unifique variações de escrita (ex: "DONA" → "DONO", "VENDEDORA" → "VENDEDOR") para
              manter os cadastros limpos.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">De (Termo na Planilha)</th>
                    <th className="py-2 px-3">Para (Cargo Padronizado)</th>
                    <th className="py-2 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {synonyms.map((syn, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono">{syn.from}</td>
                      <td className="py-2 px-3 font-semibold">{syn.to}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setSynonyms(synonyms.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="text"
                placeholder="Ex: DONA"
                value={newSynFrom}
                onChange={(e) => setNewSynFrom(e.target.value)}
                className="px-2 py-1.5 border rounded w-1/3"
              />
              <span>→</span>
              <input
                type="text"
                placeholder="Ex: DONO"
                value={newSynTo}
                onChange={(e) => setNewSynTo(e.target.value)}
                className="px-2 py-1.5 border rounded w-1/3"
              />
              <button
                type="button"
                onClick={handleAddSynonym}
                className="px-3 py-1.5 bg-slate-800 text-white rounded font-semibold text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Voltar
            </button>
            <button
              onClick={handleProcessAndValidate}
              disabled={isValidatingDb}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {isValidatingDb ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cruzando dados com o banco...</span>
                </>
              ) : (
                <>
                  <span>Processar e Validar Dados</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== ETAPA 4: VALIDAÇÃO EM MEMÓRIA ==================== */}
      {currentStep === 4 && (
        <div className="space-y-5 animate-in fade-in">
          {/* CARDS DE RESUMO DA VALIDAÇÃO */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">
                Revendas na Planilha
              </span>
              <span className="text-xl font-bold text-blue-900">
                {validationSummary.totalRevendas}
              </span>
              {validationSummary.revendasExistentes > 0 && (
                <span className="text-[10px] text-blue-700 block mt-0.5">
                  ({validationSummary.revendasExistentes} já no banco)
                </span>
              )}
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-indigo-600 block">
                Contatos na Planilha
              </span>
              <span className="text-xl font-bold text-indigo-900">
                {validationSummary.totalContatos}
              </span>
              {validationSummary.contatosExistentes > 0 && (
                <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
                  ({validationSummary.contatosExistentes} serão atualizados)
                </span>
              )}
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                Novos Contatos
              </span>
              <span className="text-xl font-bold text-emerald-900">
                {validationSummary.totalContatos - validationSummary.contatosExistentes}
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">Sem duplicar</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-600 block">
                Contatos sem E-mail
              </span>
              <span className="text-xl font-bold text-amber-900">
                {validationSummary.contatosSemEmail}
              </span>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-600 block">
                E-mails Inválidos
              </span>
              <span className="text-xl font-bold text-rose-900">
                {validationSummary.emailsInvalidos}
              </span>
            </div>
            <div
              className={`p-3 rounded-xl border ${
                validationSummary.nomesIguaisInsideSales > 0
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold block ${
                  validationSummary.nomesIguaisInsideSales > 0 ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                Nome = Inside Sales
              </span>
              <span
                className={`text-xl font-bold ${
                  validationSummary.nomesIguaisInsideSales > 0 ? 'text-amber-900' : 'text-slate-700'
                }`}
              >
                {validationSummary.nomesIguaisInsideSales}
              </span>
              {validationSummary.nomesIguaisInsideSales > 0 && (
                <span className="text-[10px] text-amber-700 block mt-0.5">Verificar coluna</span>
              )}
            </div>
          </div>

          {validationSummary.nomesIguaisInsideSales > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Possível divergência no mapeamento da coluna "Nome do Contato"
                </p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Foram identificados {validationSummary.nomesIguaisInsideSales} contato(s) cujo
                  nome é idêntico ao Inside Sales da revenda. Verifique se na Etapa 2 a coluna
                  mapeada como "Nome do Contato" não é na realidade a coluna de Inside Sales.
                </p>
              </div>
            </div>
          )}

          {/* LISTA DE REVENDAS E CONTATOS DETECTADOS */}
          <div className="border rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 font-bold text-xs text-slate-800 border-b flex items-center justify-between">
              <span>
                Pré-visualização do Modelo Relacional Gerado ({processedGroups.length} revendas)
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Linhas vazias foram associadas à revenda pai correspondente
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y text-xs">
              {processedGroups.slice(0, 15).map((g, idx) => (
                <div key={idx} className="p-3 hover:bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {g.codigo && (
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          {g.codigo}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{g.nome}</span>
                      <span className="text-[11px] text-slate-500">
                        ({g.segmento} • {g.estado || 'Sem UF'})
                      </span>
                      {g.isExisting ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Já cadastrada — será atualizada
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Nova revenda
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {g.contatos.length} contato(s)
                    </span>
                  </div>

                  {/* Contatos filhos com indicação de duplicidade / atualização */}
                  <div className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1.5">
                    {g.contatos.map((c, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center justify-between text-[11px] text-slate-600"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{c.nome}</span>
                          {c.cargo && <span className="text-slate-400">({c.cargo})</span>}
                          {c.isPrincipal && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                              Principal
                            </span>
                          )}
                          {c.isExisting ? (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-semibold px-1.5 py-0.5 rounded">
                              Já cadastrado — será atualizado
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-1.5 py-0.5 rounded">
                              Novo registro
                            </span>
                          )}
                          {c.issues.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{c.issues[0]}</span>
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-slate-500">{c.email || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Voltar
            </button>
            <button
              onClick={handleExecuteImport}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirmar e Importar no Banco de Dados</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== ETAPA 5: PROGRESSO E CONCLUSÃO ==================== */}
      {currentStep === 5 && (
        <div className="space-y-6 text-center py-6 animate-in fade-in">
          {isImporting ? (
            <div className="space-y-4 max-w-md mx-auto">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                Gravando registros no PocketBase...
              </h3>
              <p className="text-xs text-slate-500">{importStatusText}</p>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-blue-600">{importProgress}%</span>
            </div>
          ) : importCompleted ? (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Importação Concluída com Sucesso!
              </h3>
              <p className="text-xs text-slate-500">
                Todos os dados foram gravados nas tabelas correspondentes e a auditoria foi
                registrada.
              </p>

              <div className="p-4 bg-slate-50 rounded-xl border grid grid-cols-2 gap-3 text-left text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Revendas Criadas
                  </span>
                  <span className="font-bold text-slate-800 text-base">
                    {importReport.revendasCriadas}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Revendas Atualizadas
                  </span>
                  <span className="font-bold text-slate-800 text-base">
                    {importReport.revendasAtualizadas}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Contatos Criados
                  </span>
                  <span className="font-bold text-emerald-600 text-base">
                    {importReport.contatosCriados}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Contatos Atualizados
                  </span>
                  <span className="font-bold text-blue-600 text-base">
                    {importReport.contatosAtualizados}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Tabelas Auxiliares
                  </span>
                  <span className="font-bold text-slate-600 text-base">
                    +{importReport.auxiliaresCriadas}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setCurrentStep(1)
                  setImportCompleted(false)
                  setRawRows([])
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
              >
                Nova Importação
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
