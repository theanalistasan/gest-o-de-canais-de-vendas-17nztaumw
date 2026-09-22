// Migration 0023: Identificar contatos afetados com nome igual ao inside sales da revenda e registrar auditoria
// NÃO inventa dados: não altera registros nem deduz nomes, apenas identifica os afetados e registra pendência de reimportação.

migrate(
  (app) => {
    try {
      // 1. Carregar todas as revendas e mapear inside_sales por id
      const allRevendas = app.findRecordsByFilter('revendas', '', 'created', 0, 0)
      const allInsideSales = app.findRecordsByFilter('inside_sales', '', 'created', 0, 0)
      const insideSalesMap = {}
      for (let i = 0; i < allInsideSales.length; i++) {
        const isRec = allInsideSales[i]
        insideSalesMap[isRec.id] = (isRec.getString('nome') || '').trim()
      }

      // Mapear revendaId -> { id, nome, codigo, insideSalesNome }
      const revendaInfoMap = {}
      for (let i = 0; i < allRevendas.length; i++) {
        const rev = allRevendas[i]
        const isId = rev.getString('inside_sales')
        const insideNome = isId ? insideSalesMap[isId] || '' : ''
        revendaInfoMap[rev.id] = {
          id: rev.id,
          nome: rev.getString('nome'),
          codigo: rev.getString('codigo'),
          insideSalesNome: insideNome,
        }
      }

      // 2. Carregar todos os contatos
      const allContatos = app.findRecordsByFilter('contatos', '', 'created', 0, 0)
      const contatosAfetados = []

      for (let i = 0; i < allContatos.length; i++) {
        const contato = allContatos[i]
        const cNome = (contato.getString('nome') || '').trim()
        const revId = contato.getString('revenda')
        const revInfo = revendaInfoMap[revId]

        if (!cNome || !revInfo) continue

        const insideNome = revInfo.insideSalesNome
        // Identificar se o nome do contato é idêntico ao inside sales da revenda (case-insensitive)
        if (insideNome && cNome.toLowerCase() === insideNome.toLowerCase()) {
          contatosAfetados.push({
            contatoId: contato.id,
            nomeAtualErrado: cNome,
            email: contato.getString('email'),
            revendaId: revId,
            revendaNome: revInfo.nome,
            revendaCodigo: revInfo.codigo,
            insideSalesNome: insideNome,
          })
        }
      }

      console.log(
        'Migration 0023: Total de ' +
          contatosAfetados.length +
          ' contatos identificados com nome igual ao inside sales da revenda.',
      )

      // 3. Registrar na auditoria
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'AUDITORIA_NOMES_INCORRETOS_IMPORTACAO')
      recAud.set('registro', 'contatos/pendentes_reimportacao')

      // Tentar associar ao usuário administrador se encontrado
      try {
        const adminUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'silvio.mattos@rolanddg.com.br',
        )
        if (adminUser) {
          recAud.set('usuario', adminUser.id)
        }
      } catch (_) {}

      recAud.set('valor_anterior', {
        status: 'PENDENTE_CORRECAO_VIA_REIMPORTACAO',
        total_afetados: contatosAfetados.length,
        motivo:
          'Contatos gravados erroneamente com o nome do Inside Sales da revenda durante importação anterior.',
        acao_necessaria:
          'Usuário deve reimportar a planilha pelo Assistente de Importação com a opção de mesclagem ativa para atualizar os nomes corretos.',
      })

      recAud.set('novo_valor', {
        total_identificados: contatosAfetados.length,
        contatos_afetados: contatosAfetados,
        data_identificacao: new Date().toISOString(),
      })

      app.save(recAud)
      console.log('Migration 0023: Registro de auditoria gravado com sucesso.')
    } catch (err) {
      console.log('Erro na migration 0023_identificar_contatos_afetados: ' + err)
      throw err
    }
  },
  (app) => {
    // Reverter registro de auditoria criado
    try {
      const records = app.findRecordsByFilter(
        'auditoria',
        "acao = 'AUDITORIA_NOMES_INCORRETOS_IMPORTACAO'",
        '',
        1,
        0,
      )
      for (let i = 0; i < records.length; i++) {
        app.delete(records[i])
      }
    } catch (_) {}
  },
)
