migrate(
  (app) => {
    const email = 'silvio.mattos@rolanddg.com.br'
    const newPass = 'Skip@Pass'

    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', email)
      existing.setPassword(newPass)
      existing.setVerified(true)
      existing.set('role', 'admin')
      existing.set('name', 'Silvio Mattos')
      app.save(existing)
    } catch (_) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const record = new Record(users)
      record.setEmail(email)
      record.setPassword(newPass)
      record.setVerified(true)
      record.set('role', 'admin')
      record.set('name', 'Silvio Mattos')
      app.save(record)
    }
  },
  (app) => {
    // Reversão opcional/noop: não remove o usuário administrador para evitar perda de dados
  },
)
