// Migration 0039: Criar usuário de integração e consolidar/fechar regras de API
// 1. Cria ou atualiza o usuário de serviço integracao.painel@rolanddg.com.br (role: 'consulta', verified: true)
//    com senha forte para integração via API.
// 2. Garante regras de API restritas e fechadas para todas as coleções de negócio e auxiliares:
//    - list/view: '@request.auth.id != ""' (fechadas para acesso público não-autenticado)
//    - create/update/delete: restritos por perfil (consulta NÃO pode alterar nada; somente leitura)

migrate(
  (app) => {
    // -------------------------------------------------------------
    // PARTE 1: Usuário dedicado de integração
    // -------------------------------------------------------------
    const integrationEmail = 'integracao.painel@rolanddg.com.br'
    // Senha forte de serviço gerada para a integração com Painel de Vendas Consolidado
    const integrationPassword = 'Roland#PainelInt!2026$Sec'
    const integrationName = 'Integração Painel de Vendas'
    const integrationRole = 'consulta'

    let userRecord = null
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', integrationEmail)
      userRecord.setPassword(integrationPassword)
      userRecord.setVerified(true)
      userRecord.set('role', integrationRole)
      userRecord.set('name', integrationName)
      app.save(userRecord)
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      userRecord = new Record(usersCol)
      userRecord.setEmail(integrationEmail)
      userRecord.setPassword(integrationPassword)
      userRecord.setVerified(true)
      userRecord.set('role', integrationRole)
      userRecord.set('name', integrationName)
      app.save(userRecord)
    }

    // Validação de senha do usuário criado
    const checkUser = app.findAuthRecordByEmail('_pb_users_auth_', integrationEmail)
    if (!checkUser.validatePassword(integrationPassword)) {
      throw new Error('Falha ao validar senha do usuário de integração: ' + integrationEmail)
    }
    console.log(
      'MIGRATION_0039: Usuário de integração assegurado com sucesso. ID=' +
        checkUser.id +
        ', Email=' +
        checkUser.email +
        ', Role=' +
        checkUser.getString('role'),
    )

    // -------------------------------------------------------------
    // PARTE 2: Fechar e consolidar regras de API (RLS)
    // -------------------------------------------------------------

    // 2.1 Coleções de dados principais: revendas e contatos
    // list/view: autenticado (@request.auth.id != '')
    // create/update: admin, gestor, suporte (consulta NÃO pode)
    // delete: admin, gestor
    const coreCols = ['revendas', 'contatos']
    for (let i = 0; i < coreCols.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(coreCols[i])
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule =
          "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
        col.updateRule =
          "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte'"
        col.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
        app.save(col)
      } catch (err) {
        console.log('Erro ao atualizar regras da colecao ' + coreCols[i] + ': ' + err)
      }
    }

    // 2.2 Coleções auxiliares de cadastro:
    // segmentos, inside_sales, responsaveis, canais_faturamento, cargos, estados, status_revenda
    // list/view: autenticado (@request.auth.id != '')
    // create/update: admin, suporte (consulta NÃO pode)
    // delete: admin
    const auxCols = [
      'segmentos',
      'inside_sales',
      'responsaveis',
      'canais_faturamento',
      'cargos',
      'estados',
      'status_revenda',
    ]
    for (let j = 0; j < auxCols.length; j++) {
      try {
        const col = app.findCollectionByNameOrId(auxCols[j])
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'suporte'"
        col.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'suporte'"
        col.deleteRule = "@request.auth.role = 'admin'"
        app.save(col)
      } catch (errAux) {
        console.log('Erro ao atualizar regras da auxiliar ' + auxCols[j] + ': ' + errAux)
      }
    }

    // 2.3 Coleções de administração e templates:
    // remetentes: admin total
    try {
      const remetentes = app.findCollectionByNameOrId('remetentes')
      remetentes.listRule = "@request.auth.id != ''"
      remetentes.viewRule = "@request.auth.id != ''"
      remetentes.createRule = "@request.auth.role = 'admin'"
      remetentes.updateRule = "@request.auth.role = 'admin'"
      remetentes.deleteRule = "@request.auth.role = 'admin'"
      app.save(remetentes)
    } catch (eRem) {
      console.log('Erro ao atualizar regras de remetentes: ' + eRem)
    }

    // email_templates: admin ou gestor
    try {
      const templates = app.findCollectionByNameOrId('email_templates')
      templates.listRule = "@request.auth.id != ''"
      templates.viewRule = "@request.auth.id != ''"
      templates.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      templates.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      templates.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      app.save(templates)
    } catch (eTmpl) {
      console.log('Erro ao atualizar regras de email_templates: ' + eTmpl)
    }

    // campanhas: admin ou gestor
    try {
      const campanhas = app.findCollectionByNameOrId('campanhas')
      campanhas.listRule = "@request.auth.id != ''"
      campanhas.viewRule = "@request.auth.id != ''"
      campanhas.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      campanhas.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      campanhas.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      app.save(campanhas)
    } catch (eCamp) {
      console.log('Erro ao atualizar regras de campanhas: ' + eCamp)
    }

    // envios: admin ou gestor para criação/edição; delete admin com status 'Erro'
    try {
      const envios = app.findCollectionByNameOrId('envios')
      envios.listRule = "@request.auth.id != ''"
      envios.viewRule = "@request.auth.id != ''"
      envios.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      envios.updateRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      envios.deleteRule = "@request.auth.role = 'admin' && status = 'Erro'"
      app.save(envios)
    } catch (eEnv) {
      console.log('Erro ao atualizar regras de envios: ' + eEnv)
    }

    // auditoria: apenas leitura autenticada; escrita somente pelo sistema/hooks (null)
    try {
      const auditoria = app.findCollectionByNameOrId('auditoria')
      auditoria.listRule = "@request.auth.id != ''"
      auditoria.viewRule = "@request.auth.id != ''"
      auditoria.createRule = null
      auditoria.updateRule = null
      auditoria.deleteRule = null
      app.save(auditoria)
    } catch (eAud) {
      console.log('Erro ao atualizar regras de auditoria: ' + eAud)
    }

    // users: list e view autenticados; create e delete admin;
    // update: admin ou próprio usuário (exceto papel consulta)
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.listRule = "@request.auth.id != ''"
      users.viewRule = "@request.auth.id != ''"
      users.createRule = "@request.auth.role = 'admin'"
      users.updateRule =
        "@request.auth.role = 'admin' || (@request.auth.id = id && @request.auth.role != 'consulta')"
      users.deleteRule = "@request.auth.role = 'admin'"
      app.save(users)
    } catch (eUsers) {
      console.log('Erro ao atualizar regras de users: ' + eUsers)
    }

    console.log(
      'MIGRATION_0039_SUCCESS: Regras de API fechadas e consolidadas para todas as coleções.',
    )
  },
  (app) => {
    try {
      const u = app.findAuthRecordByEmail('_pb_users_auth_', 'integracao.painel@rolanddg.com.br')
      app.delete(u)
    } catch (_) {}
  },
)
