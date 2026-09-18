migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Idempotente: verificar se silvio.mattos@rolanddg.com.br já existe
    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', 'silvio.mattos@rolanddg.com.br')
      existing.set('role', 'admin')
      existing.set('name', 'Silvio Mattos')
      existing.setVerified(true)
      app.save(existing)
      return
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('silvio.mattos@rolanddg.com.br')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Silvio Mattos')
    record.set('role', 'admin')
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'silvio.mattos@rolanddg.com.br')
      app.delete(record)
    } catch (_) {}
  },
)
