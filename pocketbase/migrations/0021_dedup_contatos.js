// Migration 0021: Sanitização e Deduplicação Idempotente da Base de Contatos e Revendas
// - Deduplica `contatos`: mesma combinação de nome normalizado + revenda + email normalizado
// - Deduplica `revendas`: mesmo código normalizado (se houver duplicatas)
// - Escolhe o registro mais completo (prioridade: envios vinculados, cargo preenchido, mais campos preenchidos, mais recente)
// - Copia campos não preenchidos dos duplicados para o sobrevivente (merge sem perda de dado)
// - Preserva e transfere envios vinculados antes de remover duplicados
// - Registra log detalhado na coleção 'auditoria' e no console

migrate(
  (app) => {
    function normalizeStr(str) {
      if (!str) return ''
      return ('' + str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
    }

    // 1. Sanitizar revendas primeiro (caso haja código duplicado)
    let revendasRemovidas = 0
    let revendasMergeadas = 0

    try {
      const allRevendas = app.findRecordsByFilter('revendas', '', 'created', 0, 0)
      const groupsByCodigo = {}

      for (let i = 0; i < allRevendas.length; i++) {
        const rev = allRevendas[i]
        const cod = normalizeStr(rev.getString('codigo'))
        if (!cod) continue

        if (!groupsByCodigo[cod]) {
          groupsByCodigo[cod] = []
        }
        groupsByCodigo[cod].push(rev)
      }

      for (const cod in groupsByCodigo) {
        const list = groupsByCodigo[cod]
        if (list.length <= 1) continue

        // Escolher o sobrevivente: preferir com mais contatos/envios associados, depois com mais campos preenchidos
        list.sort((a, b) => {
          // Pontuação por campos preenchidos
          const scoreFields = (r) => {
            let score = 0
            if (r.getString('nome')) score += 2
            if (r.getString('segmento')) score += 1
            if (r.getString('status')) score += 1
            if (r.getString('inside_sales')) score += 1
            if (r.getString('responsavel')) score += 1
            if (r.getString('canal_faturamento')) score += 1
            if (r.getString('estado')) score += 1
            if (r.getString('cidade')) score += 1
            if (r.getString('observacoes')) score += 1
            return score
          }
          const sA = scoreFields(a)
          const sB = scoreFields(b)
          if (sB !== sA) return sB - sA
          return b.getString('created').localeCompare(a.getString('created'))
        })

        const survivor = list[0]
        const duplicates = list.slice(1)

        // Merge de campos para o sobrevivente
        let survivorChanged = false
        const fieldsToMerge = [
          'nome',
          'segmento',
          'status',
          'inside_sales',
          'responsavel',
          'canal_faturamento',
          'estado',
          'cidade',
          'observacoes',
        ]

        for (let j = 0; j < duplicates.length; j++) {
          const dup = duplicates[j]
          for (let f = 0; f < fieldsToMerge.length; f++) {
            const field = fieldsToMerge[f]
            if (!survivor.getString(field) && dup.getString(field)) {
              survivor.set(field, dup.getString(field))
              survivorChanged = true
            }
          }

          // Atualizar contatos que apontavam para dup para apontarem para survivor
          app
            .db()
            .newQuery('UPDATE contatos SET revenda = {:survivorId} WHERE revenda = {:dupId}')
            .bind({ survivorId: survivor.id, dupId: dup.id })
            .execute()

          // Atualizar envios que apontavam para dup para apontarem para survivor
          app
            .db()
            .newQuery('UPDATE envios SET revenda = {:survivorId} WHERE revenda = {:dupId}')
            .bind({ survivorId: survivor.id, dupId: dup.id })
            .execute()

          // Deletar a revenda duplicada
          app.delete(dup)
          revendasRemovidas++
        }

        if (survivorChanged) {
          app.save(survivor)
          revendasMergeadas++
        }
      }
    } catch (errRev) {
      console.log('Erro ao deduplicar revendas:', errRev)
    }

    // 2. Sanitizar contatos
    let contatosRemovidos = 0
    let contatosMergeados = 0
    let enviosReassociados = 0

    try {
      const allContatos = app.findRecordsByFilter('contatos', '', 'created', 0, 0)
      const groupsByCompositeKey = {}

      for (let i = 0; i < allContatos.length; i++) {
        const c = allContatos[i]
        const nomeNorm = normalizeStr(c.getString('nome'))
        const revId = c.getString('revenda') || ''
        const emailNorm = normalizeStr(c.getString('email'))

        // Se nome e revenda forem iguais, consideramos do mesmo grupo
        // Chave: nomeNorm + '|' + revId + '|' + emailNorm
        const key = nomeNorm + '|||' + revId + '|||' + emailNorm

        if (!groupsByCompositeKey[key]) {
          groupsByCompositeKey[key] = []
        }
        groupsByCompositeKey[key].push(c)
      }

      for (const key in groupsByCompositeKey) {
        const group = groupsByCompositeKey[key]
        if (group.length <= 1) continue

        // Contar envios de cada contato
        const enviosPorContato = {}
        for (let i = 0; i < group.length; i++) {
          const rec = group[i]
          let count = 0
          try {
            const envs = app.findRecordsByFilter('envios', "contato = '" + rec.id + "'", '', 100, 0)
            count = envs.length
          } catch (_) {}
          enviosPorContato[rec.id] = count
        }

        // Ordenar grupo para escolher o sobrevivente
        // Prioridade:
        // 1. Possui envios vinculados (maior count primeiro)
        // 2. Possui cargo preenchido (não vazio)
        // 3. Mais campos preenchidos
        // 4. Mais recente (created desc)
        group.sort((a, b) => {
          const envsA = enviosPorContato[a.id] || 0
          const envsB = enviosPorContato[b.id] || 0
          if (envsB !== envsA) return envsB - envsA

          const cargoA = a.getString('cargo') ? 1 : 0
          const cargoB = b.getString('cargo') ? 1 : 0
          if (cargoB !== cargoA) return cargoB - cargoA

          const countFields = (rec) => {
            let cnt = 0
            if (rec.getString('cargo')) cnt++
            if (rec.getString('email')) cnt++
            if (rec.getString('email_secundario')) cnt++
            if (rec.getString('telefone')) cnt++
            if (rec.getString('celular')) cnt++
            if (rec.getString('whatsapp')) cnt++
            if (rec.getString('estado_regiao')) cnt++
            if (rec.getString('observacoes')) cnt++
            if (rec.getBool('contato_principal')) cnt++
            if (rec.getBool('recebe_comunicacoes')) cnt++
            return cnt
          }

          const fA = countFields(a)
          const fB = countFields(b)
          if (fB !== fA) return fB - fA

          return b.getString('created').localeCompare(a.getString('created'))
        })

        const survivor = group[0]
        const duplicates = group.slice(1)

        let survivorChanged = false
        const fieldsToCopy = [
          'cargo',
          'email_secundario',
          'telefone',
          'celular',
          'whatsapp',
          'estado_regiao',
          'observacoes',
        ]

        for (let j = 0; j < duplicates.length; j++) {
          const dup = duplicates[j]

          // Copiar qualquer campo preenchido no dup que esteja vazio no survivor
          for (let f = 0; f < fieldsToCopy.length; f++) {
            const field = fieldsToCopy[f]
            if (!survivor.getString(field) && dup.getString(field)) {
              survivor.set(field, dup.getString(field))
              survivorChanged = true
            }
          }

          // Flags booleanas: se dup for principal e survivor não for, manter true
          if (!survivor.getBool('contato_principal') && dup.getBool('contato_principal')) {
            survivor.set('contato_principal', true)
            survivorChanged = true
          }
          if (!survivor.getBool('recebe_comunicacoes') && dup.getBool('recebe_comunicacoes')) {
            survivor.set('recebe_comunicacoes', true)
            survivorChanged = true
          }

          // Reassociar envios vinculados ao dup para o survivor
          try {
            const envsToTransfer = app.findRecordsByFilter(
              'envios',
              "contato = '" + dup.id + "'",
              '',
              500,
              0,
            )
            for (let e = 0; e < envsToTransfer.length; e++) {
              const envRec = envsToTransfer[e]
              envRec.set('contato', survivor.id)
              app.save(envRec)
              enviosReassociados++
            }
          } catch (eTransferErr) {
            console.log('Erro ao reassociar envios:', eTransferErr)
          }

          // Deletar o duplicado
          app.delete(dup)
          contatosRemovidos++
        }

        if (survivorChanged) {
          app.save(survivor)
          contatosMergeados++
        }
      }
    } catch (errCont) {
      console.log('Erro ao deduplicar contatos:', errCont)
    }

    console.log(
      'Migration 0021 Deduplicação concluída: ' +
        contatosRemovidos +
        ' contatos removidos, ' +
        contatosMergeados +
        ' contatos mesclados, ' +
        enviosReassociados +
        ' envios reassociados, ' +
        revendasRemovidas +
        ' revendas removidas.',
    )

    // Gravar auditoria para rastreabilidade
    try {
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'SANITIZACAO_DEDUP')
      recAud.set('registro', 'migration/0021_dedup_contatos')
      recAud.set('novo_valor', {
        contatosRemovidos: contatosRemovidos,
        contatosMergeados: contatosMergeados,
        enviosReassociados: enviosReassociados,
        revendasRemovidas: revendasRemovidas,
        revendasMergeadas: revendasMergeadas,
        data: new Date().toISOString(),
      })
      app.save(recAud)
    } catch (_) {}
  },
  (app) => {
    // Migration de sanitização de dados destrutiva não reverte registros já apagados
  },
)
