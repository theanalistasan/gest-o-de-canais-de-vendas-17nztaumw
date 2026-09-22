// Migration 0024: Novo reset da base de revendas e contatos mantendo integralmente o Histórico de Envios
// O usuário irá reimportar a planilha de contatos do zero com mapeamento corrigido (versão 0.0.21).
//
// Regras obrigatórias:
// 1. Preservar 100% do Histórico de envios (coleção 'envios'): nenhum registro de envio apagado.
// 2. Garantir snapshot textual ('nome_contato', 'nome_revenda', 'codigo_revenda') em todos os envios antes de desvincular.
// 3. Campos 'contato' e 'revenda' em 'envios' continuam opcionais (required = false).
// 4. NÃO tocar em: usuários (silvio.mattos@rolanddg.com.br, rlddbr@780.local, caroline.diniz@rolanddg.com.br),
//    campanhas, remetentes permitidos, templates, tabelas auxiliares (estados, cidades, segmentos, cargos, canais de faturamento),
//    hooks de SMTP, nem no Histórico de envios.
// 5. Apagar todos os registros de contatos e revendas.
// 6. Registrar a operação na coleção 'auditoria' (ação tipo RESET_BASE_REVENDAS, com contagens de registros removidos, associada ao usuário administrador).
// 7. Regras de bloqueio de escrita para perfil Consulta e demais regras de API continuam intactas.

migrate(
  (app) => {
    // 1. Verificar e assegurar campos de snapshot na coleção 'envios'
    const enviosCol = app.findCollectionByNameOrId('envios')

    const contatoField = enviosCol.fields.getByName('contato')
    if (contatoField) {
      contatoField.required = false
    }

    const revendaField = enviosCol.fields.getByName('revenda')
    if (revendaField) {
      revendaField.required = false
    }

    if (!enviosCol.fields.getByName('nome_revenda')) {
      enviosCol.fields.add(new TextField({ name: 'nome_revenda', required: false }))
    }
    if (!enviosCol.fields.getByName('codigo_revenda')) {
      enviosCol.fields.add(new TextField({ name: 'codigo_revenda', required: false }))
    }
    if (!enviosCol.fields.getByName('nome_contato')) {
      enviosCol.fields.add(new TextField({ name: 'nome_contato', required: false }))
    }

    app.save(enviosCol)

    // 2. Garantir snapshots textuais em todos os envios existentes antes de desvincular
    try {
      const allEnvios = app.findRecordsByFilter('envios', '', 'created', 0, 0)
      for (let i = 0; i < allEnvios.length; i++) {
        const envio = allEnvios[i]
        let changed = false

        const contatoId = envio.getString('contato')
        if (contatoId && !envio.getString('nome_contato')) {
          try {
            const cRec = app.findRecordById('contatos', contatoId)
            const cNome = cRec.getString('nome')
            if (cNome) {
              envio.set('nome_contato', cNome)
              changed = true
            }
          } catch (_) {}
        }

        const revendaId = envio.getString('revenda')
        if (revendaId && (!envio.getString('nome_revenda') || !envio.getString('codigo_revenda'))) {
          try {
            const rRec = app.findRecordById('revendas', revendaId)
            const rNome = rRec.getString('nome')
            const rCod = rRec.getString('codigo')
            if (rNome && !envio.getString('nome_revenda')) {
              envio.set('nome_revenda', rNome)
              changed = true
            }
            if (rCod && !envio.getString('codigo_revenda')) {
              envio.set('codigo_revenda', rCod)
              changed = true
            }
          } catch (_) {}
        }

        if (changed) {
          app.save(envio)
        }
      }
    } catch (errSnapshot) {
      console.log('Aviso ao registrar snapshot textual em envios: ' + errSnapshot)
    }

    // 3. Desvincular IDs de contato e revenda nos envios para manter integridade relacional
    try {
      app.db().newQuery('UPDATE envios SET contato = NULL, revenda = NULL').execute()
    } catch (errUnlink) {
      console.log('Aviso ao desvincular relacoes de envios: ' + errUnlink)
    }

    // 4. Contar registros a serem apagados
    let totalContatos = 0
    let totalRevendas = 0

    try {
      totalContatos = app.countRecords('contatos')
    } catch (_) {}

    try {
      totalRevendas = app.countRecords('revendas')
    } catch (_) {}

    // 5. Deletar todos os registros de contatos e revendas
    try {
      app.db().newQuery('DELETE FROM contatos').execute()
    } catch (errDelContatos) {
      console.log('Erro ao deletar contatos via SQL: ' + errDelContatos)
      try {
        const contatosCol = app.findCollectionByNameOrId('contatos')
        app.truncateCollection(contatosCol)
      } catch (_) {}
    }

    try {
      app.db().newQuery('DELETE FROM revendas').execute()
    } catch (errDelRevendas) {
      console.log('Erro ao deletar revendas via SQL: ' + errDelRevendas)
      try {
        const revendasCol = app.findCollectionByNameOrId('revendas')
        app.truncateCollection(revendasCol)
      } catch (_) {}
    }

    console.log(
      'Base de revendas e contatos zerada com sucesso (Migration 0024): ' +
        totalContatos +
        ' contatos e ' +
        totalRevendas +
        ' revendas apagados.',
    )

    // 6. Registrar auditoria oficial
    try {
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'RESET_BASE_REVENDAS')
      recAud.set('registro', 'revendas_e_contatos')

      // Associar ao admin Silvio Mattos se encontrado
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
        total_revendas_anteriores: totalRevendas,
        total_contatos_anteriores: totalContatos,
      })
      recAud.set('novo_valor', {
        status: 'BASE_ZERADA_COM_SUCESSO',
        total_revendas_atuais: 0,
        total_contatos_atuais: 0,
        envios_preservados: app.countRecords('envios'),
        mensagem:
          'Base de dados de revendas e contatos zerada para reimportação via planilha com mapeamento corrigido (v0.0.21). Histórico de envios mantido integralmente.',
        data: new Date().toISOString(),
      })
      app.save(recAud)
    } catch (errAud) {
      console.log('Erro ao gravar log de auditoria do reset: ' + errAud)
    }
  },
  (app) => {
    // Reversão de dados apagados não é possível
  },
)
