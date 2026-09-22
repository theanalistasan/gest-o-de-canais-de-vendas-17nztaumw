migrate(
  (app) => {
    const email = 'rlddbr@780.local'
    const password = 'RldDBR@780'
    const name = 'RldDBR@780'
    const role = 'consulta'

    let userRecord = null

    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', email)
      userRecord.setPassword(password)
      userRecord.setVerified(true)
      userRecord.set('role', role)
      userRecord.set('name', name)
      app.save(userRecord)
    } catch (_) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      userRecord = new Record(users)
      userRecord.setEmail(email)
      userRecord.setPassword(password)
      userRecord.setVerified(true)
      userRecord.set('role', role)
      userRecord.set('name', name)
      app.save(userRecord)
    }

    // Validação estrita de senha contra a API de autenticação do Record
    const reloaded = app.findAuthRecordByEmail('_pb_users_auth_', email)
    if (!reloaded.validatePassword(password)) {
      throw new Error(
        'Falha crítica de integridade: a senha de consulta não pôde ser validada para ' + email,
      )
    }

    console.log(
      'MIGRATION_0029_SUCCESS: Usuário consulta confirmado e senha validada com sucesso! id=' +
        reloaded.id +
        ', email=' +
        reloaded.email +
        ', role=' +
        reloaded.getString('role'),
    )
  },
  (app) => {
    // Reversão mantém dados intactos para não quebrar referências
  },
)
