// Migration 0025: Reset and verify admin password for silvio.mattos@rolanddg.com.br
// Garante que o usuário existe, está verificado, com role 'admin' e senha 'Skip@Pass'.
// Realiza teste de autenticação com validatePassword('Skip@Pass').

migrate(
  (app) => {
    const email = 'silvio.mattos@rolanddg.com.br'
    const password = 'Skip@Pass'

    let record
    try {
      record = app.findAuthRecordByEmail('_pb_users_auth_', email)
      record.setPassword(password)
      record.setVerified(true)
      record.set('role', 'admin')
      record.set('name', 'Silvio Mattos')
      app.save(record)
      console.log('Admin user updated successfully:', email)
    } catch (_) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      record = new Record(users)
      record.setEmail(email)
      record.setPassword(password)
      record.setVerified(true)
      record.set('role', 'admin')
      record.set('name', 'Silvio Mattos')
      app.save(record)
      console.log('Admin user created successfully:', email)
    }

    // Validação da senha recém-definida
    const checkUser = app.findAuthRecordByEmail('_pb_users_auth_', email)
    const valid = checkUser.validatePassword(password)
    if (!valid) {
      throw new Error('Falha ao validar a senha Skip@Pass para o usuario ' + email)
    }
    console.log('VALIDATION SUCCESS: Admin password confirmed valid for ' + email)
  },
  (app) => {
    // Reversão no-op
  },
)
