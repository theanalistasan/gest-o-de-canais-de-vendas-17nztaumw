migrate(
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'rlddbr@780.local')
      const ok = user.validatePassword('RldDBR@780')
      if (!ok) {
        throw new Error('validatePassword retornou false para a senha RldDBR@780')
      }
      console.log(
        'AUTH_TEST_SUCCESS: user.validatePassword OK! id=' +
          user.id +
          ' role=' +
          user.getString('role'),
      )
    } catch (err) {
      console.log('AUTH_TEST_FAILED: ' + err)
      throw new Error('Falha no teste de autenticacao: ' + err)
    }
  },
  (app) => {},
)
