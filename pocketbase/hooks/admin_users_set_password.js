// Endpoint custom: POST /backend/v1/admin-users-set-password
// Permite que usuários com perfil 'admin' alterem a senha de outros usuários
// sem exigir oldPassword (usando privilégio de nível $app / superuser)
// e registra o evento na coleção auditoria (sem salvar a senha em texto puro).

routerAdd(
  'POST',
  '/backend/v1/admin-users-set-password',
  (e) => {
    // 1. Validar autenticação e se o solicitante possui role === 'admin'
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { success: false, error: 'Autenticação necessária.' })
    }

    const requesterRole = authRecord.getString('role')
    if (requesterRole !== 'admin') {
      return e.json(403, {
        success: false,
        error: 'Acesso negado: apenas administradores podem alterar a senha de usuários.',
      })
    }

    // 2. Extrair e validar dados do body
    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const userId = (body.userId || '').toString().trim()
    const newPassword = (body.newPassword || '').toString().trim()

    if (!userId) {
      return e.json(400, { success: false, error: 'O ID do usuário é obrigatório.' })
    }

    if (!newPassword || newPassword.length < 8) {
      return e.json(400, {
        success: false,
        error: 'A nova senha deve possuir no mínimo 8 caracteres.',
      })
    }

    // 3. Carregar registro do usuário alvo
    let targetUser = null
    try {
      targetUser = $app.findRecordById('users', userId)
    } catch (errFind) {
      return e.json(404, { success: false, error: 'Usuário não encontrado: ' + errFind })
    }

    // 4. Salvar estado anterior para auditoria
    const targetEmail = targetUser.email() || targetUser.getString('email')
    const targetName = targetUser.getString('name')
    const targetRole = targetUser.getString('role')

    // 5. Atualizar a senha usando setPassword no nível $app
    try {
      targetUser.setPassword(newPassword)
      $app.save(targetUser)
    } catch (errSave) {
      return e.json(400, {
        success: false,
        error: 'Falha ao redefinir a senha do usuário: ' + errSave,
      })
    }

    // 6. Registrar trilha de auditoria (sem gravar a senha em texto puro)
    try {
      const auditoriaCol = $app.findCollectionByNameOrId('auditoria')
      const auditRecord = new Record(auditoriaCol)
      auditRecord.set('acao', 'EDICAO_SENHA')
      auditRecord.set('registro', 'users/' + targetUser.id)
      auditRecord.set('usuario', authRecord.id)
      auditRecord.set('valor_anterior', {
        id: targetUser.id,
        email: targetEmail,
        name: targetName,
        role: targetRole,
      })
      auditRecord.set('novo_valor', {
        id: targetUser.id,
        email: targetEmail,
        name: targetName,
        role: targetRole,
        senha_alterada: true,
      })
      $app.save(auditRecord)
    } catch (errAudit) {
      console.log('Aviso ao registrar auditoria de redefinição de senha: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message: 'Senha do usuário alterada com sucesso.',
      userId: targetUser.id,
    })
  },
  $apis.requireAuth(),
)
