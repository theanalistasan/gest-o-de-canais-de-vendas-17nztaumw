// Migration 0031: Validação de autenticação real para Caroline Diniz, Admin e Consulta
// Verifica via validatePassword (bcrypt interno do PB) para todos os perfis

migrate(
  (app) => {
    // 1. Caroline Diniz
    const caroline = app.findAuthRecordByEmail('_pb_users_auth_', 'caroline.diniz@rolanddg.com.br')
    if (!caroline.validatePassword('Roland@1234')) {
      throw new Error('Falha de autenticação para Caroline Diniz com Roland@1234')
    }
    if (caroline.getString('role') !== 'gestor') {
      throw new Error('Perfil de Caroline Diniz deveria ser gestor')
    }
    if (!caroline.verified()) {
      throw new Error('Caroline Diniz deve estar marcada como verificada')
    }

    // 2. Admin Silvio Mattos
    const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'silvio.mattos@rolanddg.com.br')
    if (!admin.validatePassword('Skip@Pass')) {
      throw new Error('Falha de autenticação para Admin Silvio Mattos com Skip@Pass')
    }
    if (admin.getString('role') !== 'admin') {
      throw new Error('Perfil do Admin deveria ser admin')
    }

    // 3. Consulta
    const consulta = app.findAuthRecordByEmail('_pb_users_auth_', 'rlddbr@780.local')
    if (!consulta.validatePassword('RldDBR@780')) {
      throw new Error('Falha de autenticação para Consulta com RldDBR@780')
    }

    console.log(
      'MIGRATION_0031_SUCCESS: Todos os usuários principais autenticam com sucesso! ' +
        'Caroline: ' +
        caroline.id +
        ', Admin: ' +
        admin.id +
        ', Consulta: ' +
        consulta.id,
    )
  },
  (app) => {},
)
