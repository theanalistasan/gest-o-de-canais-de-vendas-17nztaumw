// Migration 0026: Diagnóstico de backend, reset de senha do admin para Skip@Pass e validação
// 1. Inspeciona o estado da coleção users e dos usuários silvio.mattos@rolanddg.com.br e rlddbr@780.local
// 2. Garante o usuário admin com email='silvio.mattos@rolanddg.com.br', password='Skip@Pass', verified=true, role='admin', name='Silvio Mattos'
// 3. Testa a autenticação real chamando validatePassword('Skip@Pass') e via HTTP POST se aplicável
// 4. Salva log do diagnóstico detalhado na coleção auditoria

migrate(
  (app) => {
    const email = 'silvio.mattos@rolanddg.com.br'
    const password = 'Skip@Pass'

    const diagInfo = {
      timestamp: new Date().toISOString(),
      adminPreState: null,
      adminPostState: null,
      allUsers: [],
      validatePasswordResult: false,
      httpAuthResult: null,
    }

    // 1. Listar usuários existentes para entender estado prévio
    try {
      const allUsers = app.findRecordsByFilter('users', '', '-created', 20, 0)
      diagInfo.allUsers = allUsers.map((u) => ({
        id: u.id,
        email: u.email(),
        verified: u.verified(),
        role: u.getString('role'),
        name: u.getString('name'),
        created: u.getString('created'),
        updated: u.getString('updated'),
      }))
    } catch (errList) {
      diagInfo.listError = '' + errList
    }

    // 2. Inspecionar admin atual se existir
    let adminRecord = null
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', email)
      diagInfo.adminPreState = {
        id: adminRecord.id,
        email: adminRecord.email(),
        verified: adminRecord.verified(),
        role: adminRecord.getString('role'),
        name: adminRecord.getString('name'),
        hasPasswordPre: adminRecord.validatePassword(password),
      }
    } catch (errFind) {
      diagInfo.adminPreState = { notFound: true, err: '' + errFind }
    }

    // 3. Redefinir ou criar admin
    if (!adminRecord) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      adminRecord = new Record(usersCol)
      adminRecord.setEmail(email)
      adminRecord.setPassword(password)
      adminRecord.setVerified(true)
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Silvio Mattos')
      app.save(adminRecord)
      console.log('Migration 0026: Admin user created afresh:', email)
    } else {
      adminRecord.setPassword(password)
      adminRecord.setVerified(true)
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Silvio Mattos')
      app.save(adminRecord)
      console.log('Migration 0026: Admin user updated with new password:', email)
    }

    // 4. Re-consultar e validar hash de senha
    const checkUser = app.findAuthRecordByEmail('_pb_users_auth_', email)
    const isValid = checkUser.validatePassword(password)
    diagInfo.validatePasswordResult = isValid

    diagInfo.adminPostState = {
      id: checkUser.id,
      email: checkUser.email(),
      verified: checkUser.verified(),
      role: checkUser.getString('role'),
      name: checkUser.getString('name'),
      isValid: isValid,
    }

    if (!isValid) {
      throw new Error(
        'FALHA CRÍTICA: validatePassword(Skip@Pass) retornou false logo após salvar o admin!',
      )
    }

    // 5. Teste HTTP real contra a rota /api/collections/users/auth-with-password
    try {
      let baseUrl = $os.getenv('VITE_POCKETBASE_URL') || 'http://127.0.0.1:8090'
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

      const httpRes = $http.send({
        url: baseUrl + '/api/collections/users/auth-with-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: email,
          password: password,
        }),
        timeout: 10,
      })

      diagInfo.httpAuthResult = {
        urlUsed: baseUrl,
        statusCode: httpRes.statusCode,
        tokenReceived: !!(httpRes.json && httpRes.json.token),
        roleReceived: httpRes.json && httpRes.json.record ? httpRes.json.record.role : null,
      }
    } catch (httpErr) {
      diagInfo.httpAuthResult = { error: '' + httpErr }
    }

    // 6. Gravar auditoria
    try {
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'RESET_ADMIN_PASSWORD_0026')
      recAud.set('registro', 'users/' + checkUser.id)
      recAud.set('usuario', checkUser.id)
      recAud.set('novo_valor', diagInfo)
      app.save(recAud)
    } catch (audErr) {
      console.log('Aviso ao gravar auditoria 0026: ' + audErr)
    }

    console.log(
      'Migration 0026 CONCLUÍDA COM SUCESSO: Admin silvio.mattos@rolanddg.com.br autentica com Skip@Pass',
    )
  },
  (app) => {
    // Reversão no-op para proteger a credencial do administrador
  },
)
