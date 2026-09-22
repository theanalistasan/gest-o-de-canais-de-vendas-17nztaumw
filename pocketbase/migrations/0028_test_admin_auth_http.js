// Migration 0028: Conclusão e validação final da senha e status do administrador
// Este arquivo substitui com sucesso qualquer tentativa anterior de 0028

migrate(
  (app) => {
    const email = 'silvio.mattos@rolanddg.com.br'
    const password = 'Skip@Pass'

    const user = app.findAuthRecordByEmail('_pb_users_auth_', email)
    if (!user.validatePassword(password)) {
      throw new Error('Validacao de senha falhou para ' + email)
    }

    if (user.getString('role') !== 'admin') {
      user.set('role', 'admin')
      app.save(user)
    }

    if (!user.verified()) {
      user.setVerified(true)
      app.save(user)
    }

    console.log('Migration 0028: Admin credenciais e status 100% verificados!')
  },
  (app) => {},
)
