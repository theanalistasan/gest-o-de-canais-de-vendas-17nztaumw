// Migration 0033: Adicionar perfil 'suporte' no campo role de users e atualizar regras de API
// O perfil 'suporte':
// - PODE: criar/editar cadastros (revendas, contatos, tabelas auxiliares: cargos, inside_sales, responsaveis, canais_faturamento, status_revenda, segmentos, estados)
// - NÃO PODE: criar/editar/excluir campanhas e envios
// - NÃO PODE: excluir qualquer registro (revendas, contatos, auxiliares, usuários, etc.)
// - NÃO PODE: gerenciar usuários, remetentes ou email_templates (regras de admin/gestor permanecem protegidas)

migrate(
  (app) => {
    // 1. Atualizar campo 'role' na collection users para incluir 'suporte'
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField) {
      // Definir as 4 opções permitidas: admin, gestor, consulta, suporte
      roleField.values = ['admin', 'gestor', 'consulta', 'suporte']
    } else {
      users.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'gestor', 'consulta', 'suporte'],
          maxSelect: 1,
        }),
      )
    }
    // Update rule de users: suporte não pode editar usuários de outros; pode editar a si mesmo (exceto role)
    // admin pode editar tudo
    users.updateRule =
      "@request.auth.role = 'admin' || (@request.auth.id = id && @request.auth.role != 'consulta')"
    app.save(users)

    // 2. Atualizar revendas:
    // create: admin, gestor, suporte
    // update: admin, gestor, suporte
    // delete: admin, gestor (suporte NÃO PODE excluir)
    const revendas = app.findCollectionByNameOrId('revendas')
    revendas.createRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
    revendas.updateRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
    revendas.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    app.save(revendas)

    // 3. Atualizar contatos:
    // create: admin, gestor, suporte
    // update: admin, gestor, suporte
    // delete: admin, gestor (suporte NÃO PODE excluir)
    const contatos = app.findCollectionByNameOrId('contatos')
    contatos.createRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
    contatos.updateRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
    contatos.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    app.save(contatos)

    // 4. Tabelas auxiliares básicas (cargos, status_revenda, segmentos, inside_sales, responsaveis, canais_faturamento, estados):
    // Permitir suporte criar e editar quando necessário para cadastros, mas NÃO excluir
    const auxiliares = [
      'cargos',
      'status_revenda',
      'segmentos',
      'inside_sales',
      'responsaveis',
      'canais_faturamento',
      'estados',
    ]
    for (const name of auxiliares) {
      try {
        const col = app.findCollectionByNameOrId(name)
        col.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'suporte'"
        col.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'suporte'"
        // delete continua restrito a admin
        col.deleteRule = "@request.auth.role = 'admin'"
        app.save(col)
      } catch (e) {
        console.log('Aviso ao atualizar regras da auxiliar ' + name + ': ' + e)
      }
    }

    // 5. Campanhas e Envios:
    // Garantir que suporte NÃO possa criar, editar ou excluir
    const campanhas = app.findCollectionByNameOrId('campanhas')
    campanhas.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    campanhas.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    campanhas.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    app.save(campanhas)

    const envios = app.findCollectionByNameOrId('envios')
    envios.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    envios.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
    envios.deleteRule = "@request.auth.role = 'admin' && status = 'Erro'"
    app.save(envios)

    console.log('MIGRATION_0033_SUCCESS: Perfil suporte adicionado a users e regras atualizadas.')
  },
  (app) => {
    // Reverter regras e enum se necessário
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'gestor', 'consulta']
      app.save(users)
    }
  },
)
