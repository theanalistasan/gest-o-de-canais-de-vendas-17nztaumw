/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Lista de coleções que devem proibir estritamente qualquer escrita/alteração do perfil 'consulta'
    const adminOrGestorCols = ['revendas', 'contatos', 'campanhas']

    for (const name of adminOrGestorCols) {
      try {
        const col = app.findCollectionByNameOrId(name)
        col.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
        col.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
        col.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
        app.save(col)
      } catch (err) {
        console.log(`Erro ao atualizar regras da colecao ${name}: ${err}`)
      }
    }

    // Regras de envios: criação e atualização restritas a admin/gestor; deleção restrita a admin para status 'Erro'
    try {
      const envios = app.findCollectionByNameOrId('envios')
      envios.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      envios.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      envios.deleteRule = "@request.auth.role = 'admin' && status = 'Erro'"
      app.save(envios)
    } catch (err) {
      console.log(`Erro ao atualizar regras de envios: ${err}`)
    }

    // Tabelas auxiliares e remetentes: exclusivas de admin (gestão restrita à administração)
    const adminOnlyCols = [
      'segmentos',
      'inside_sales',
      'responsaveis',
      'canais_faturamento',
      'cargos',
      'estados',
      'status_revenda',
      'remetentes',
    ]

    for (const name of adminOnlyCols) {
      try {
        const col = app.findCollectionByNameOrId(name)
        col.createRule = "@request.auth.role = 'admin'"
        col.updateRule = "@request.auth.role = 'admin'"
        col.deleteRule = "@request.auth.role = 'admin'"
        app.save(col)
      } catch (err) {
        console.log(`Erro ao atualizar regras da colecao ${name}: ${err}`)
      }
    }

    // Email templates: apenas admin e gestor
    try {
      const emailTemplates = app.findCollectionByNameOrId('email_templates')
      emailTemplates.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      emailTemplates.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      emailTemplates.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      app.save(emailTemplates)
    } catch (err) {
      console.log(`Erro ao atualizar regras de email_templates: ${err}`)
    }

    // Users: create e delete admin; update apenas admin ou o próprio usuário DESDE QUE não altere seu próprio role para admin/gestor
    try {
      const users = app.findCollectionByNameOrId('users')
      users.createRule = "@request.auth.role = 'admin'"
      users.deleteRule = "@request.auth.role = 'admin'"
      // Usuário consulta não pode alterar role
      users.updateRule =
        "@request.auth.role = 'admin' || (@request.auth.id = id && @request.auth.role != 'consulta')"
      app.save(users)
    } catch (err) {
      console.log(`Erro ao atualizar regras de users: ${err}`)
    }

    // Auditoria: apenas leitura (@request.auth.id != ''), create/update/delete nulo (apenas hooks de sistema)
    try {
      const auditoria = app.findCollectionByNameOrId('auditoria')
      auditoria.listRule = "@request.auth.id != ''"
      auditoria.viewRule = "@request.auth.id != ''"
      auditoria.createRule = null
      auditoria.updateRule = null
      auditoria.deleteRule = null
      app.save(auditoria)
    } catch (err) {
      console.log(`Erro ao atualizar regras de auditoria: ${err}`)
    }
  },
  (app) => {
    // Reverter não é estritamente necessário ou pode manter regras padrão
  },
)
