// Migration 0030: Atualizar senha e status da usuária Caroline Diniz e validar autenticação
// 1. Localiza a usuária caroline.diniz@rolanddg.com.br
// 2. Define a senha como 'Roland@1234', role='gestor', verified=true, name='Caroline Diniz'
// 3. Valida a senha usando user.validatePassword('Roland@1234')
// 4. Valida também que o administrador silvio.mattos@rolanddg.com.br continua autenticando com 'Skip@Pass'
// 5. Registra o evento na auditoria sem expor a senha em texto puro

migrate(
  (app) => {
    const carolineEmail = 'caroline.diniz@rolanddg.com.br'
    const carolinePass = 'Roland@1234'
    const carolineName = 'Caroline Diniz'
    const carolineRole = 'gestor'

    let carolineUser = null
    try {
      carolineUser = app.findAuthRecordByEmail('_pb_users_auth_', carolineEmail)
      carolineUser.setPassword(carolinePass)
      carolineUser.setVerified(true)
      carolineUser.set('role', carolineRole)
      carolineUser.set('name', carolineName)
      app.save(carolineUser)
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      carolineUser = new Record(usersCol)
      carolineUser.setEmail(carolineEmail)
      carolineUser.setPassword(carolinePass)
      carolineUser.setVerified(true)
      carolineUser.set('role', carolineRole)
      carolineUser.set('name', carolineName)
      app.save(carolineUser)
    }

    // Validação estrita da senha recém-definida
    const carolineReloaded = app.findAuthRecordByEmail('_pb_users_auth_', carolineEmail)
    if (!carolineReloaded.validatePassword(carolinePass)) {
      throw new Error(
        'Falha crítica de integridade: a senha de Caroline Diniz não pôde ser validada para ' +
          carolineEmail,
      )
    }

    // Revalidar que o admin permanece 100% operacional com Skip@Pass
    const adminEmail = 'silvio.mattos@rolanddg.com.br'
    const adminPass = 'Skip@Pass'
    const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
    if (!adminUser.validatePassword(adminPass)) {
      throw new Error(
        'Falha crítica: o administrador ' + adminEmail + ' não autenticou com a senha esperada!',
      )
    }

    // Registrar evento na auditoria sem guardar senha em texto puro
    try {
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'RESET_SENHA_USUARIO_0030')
      recAud.set('registro', 'users/' + carolineReloaded.id)
      recAud.set('usuario', adminUser.id)
      recAud.set('novo_valor', {
        email: carolineReloaded.email(),
        name: carolineReloaded.getString('name'),
        role: carolineReloaded.getString('role'),
        verified: carolineReloaded.verified(),
        senha_redefinida: true,
        motivo: 'Solicitação do administrador Silvio Mattos',
      })
      app.save(recAud)
    } catch (audErr) {
      console.log('Aviso ao registrar auditoria 0030: ' + audErr)
    }

    console.log(
      'MIGRATION_0030_SUCCESS: Caroline Diniz atualizada e validada com sucesso! Admin validado!',
    )
  },
  (app) => {
    // Reversão preserva integridade
  },
)
