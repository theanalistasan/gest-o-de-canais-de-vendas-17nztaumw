migrate(
  (app) => {
    const email = 'rlddbr@780.local'
    const password = 'RldDBR@780'
    const name = 'RldDBR@780'
    const role = 'consulta'

    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', email)
      existing.setPassword(password)
      existing.setVerified(true)
      existing.set('role', role)
      existing.set('name', name)
      app.save(existing)
    } catch (_) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const record = new Record(users)
      record.setEmail(email)
      record.setPassword(password)
      record.setVerified(true)
      record.set('role', role)
      record.set('name', name)
      app.save(record)
    }
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'rlddbr@780.local')
      app.delete(record)
    } catch (_) {}
  },
)
