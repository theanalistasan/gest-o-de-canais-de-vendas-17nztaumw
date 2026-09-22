// Migration 0032: Testar e validar redefinição de senha para Caroline Diniz e integridade de Admin e Consulta
// Valida que:
// 1. Caroline Diniz (k1rjfkqzx8vbszn) autentica com 'Roland@1234'
// 2. Admin Silvio Mattos autentica com 'Skip@Pass'
// 3. Consulta autentica com 'RldDBR@780'
// 4. Edição de dados sem alterar senha é válida
// 5. Registra auditoria do teste

migrate(
  (app) => {
    // 1. Validar e definir a senha de Caroline Diniz como Roland@1234
    const caroline = app.findAuthRecordByEmail('_pb_users_auth_', 'caroline.diniz@rolanddg.com.br')
    caroline.setPassword('Roland@1234')
    caroline.setVerified(true)
    caroline.set('role', 'gestor')
    caroline.set('name', 'Caroline Diniz')
    app.save(caroline)

    const carolineReloaded = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'caroline.diniz@rolanddg.com.br',
    )
    if (!carolineReloaded.validatePassword('Roland@1234')) {
      throw new Error('Falha ao autenticar Caroline Diniz com Roland@1234')
    }

    // 2. Validar Admin Silvio Mattos
    const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'silvio.mattos@rolanddg.com.br')
    if (!admin.validatePassword('Skip@Pass')) {
      throw new Error('Falha ao autenticar Admin Silvio Mattos com Skip@Pass')
    }

    // Testar atualização de dados do Admin sem alterar senha (PATCH de dados puro)
    admin.set('name', 'Silvio Mattos')
    admin.set('role', 'admin')
    app.save(admin)

    // Revalidar que a senha do Admin continua Skip@Pass após a alteração de dados
    const adminReloaded = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'silvio.mattos@rolanddg.com.br',
    )
    if (!adminReloaded.validatePassword('Skip@Pass')) {
      throw new Error('Falha: senha do Admin foi afetada ao salvar dados!')
    }

    // 3. Validar Consulta
    const consulta = app.findAuthRecordByEmail('_pb_users_auth_', 'rlddbr@780.local')
    if (!consulta.validatePassword('RldDBR@780')) {
      throw new Error('Falha ao autenticar Consulta com RldDBR@780')
    }

    // 4. Gravar registro em auditoria comprovando a validação
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria')
      const rec = new Record(auditCol)
      rec.set('acao', 'EDICAO_SENHA')
      rec.set('registro', 'users/' + carolineReloaded.id)
      rec.set('usuario', adminReloaded.id)
      rec.set('valor_anterior', {
        id: carolineReloaded.id,
        email: carolineReloaded.email(),
        name: carolineReloaded.getString('name'),
        role: carolineReloaded.getString('role'),
      })
      rec.set('novo_valor', {
        id: carolineReloaded.id,
        email: carolineReloaded.email(),
        name: carolineReloaded.getString('name'),
        role: carolineReloaded.getString('role'),
        senha_alterada: true,
        validado_bcrypt: true,
      })
      app.save(rec)
    } catch (eAudit) {
      console.log('Aviso ao gravar auditoria na migration 0032: ' + eAudit)
    }

    console.log(
      'MIGRATION_0032_SUCCESS: Caroline Diniz validada com Roland@1234, Admin validado com Skip@Pass (dados atualizados com sucesso), Consulta validado com RldDBR@780.',
    )
  },
  (app) => {},
)
