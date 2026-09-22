// Endpoint custom: /backend/v1/processar-envios
// Dispara o processamento dos envios pendentes de uma campanha ou de todas
// Suporta envio REAL via SMTP configurado por env vars (SMTP_HOST, SMTP_PORT, etc.) ou SIMULADO se não configurado
routerAdd(
  'POST',
  '/backend/v1/processar-envios',
  (e) => {
    // Validação estrita de autorização server-side: perfil 'consulta' NÃO pode disparar envios
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { success: false, error: 'Autenticação necessária.' })
    }
    const userRole = authRecord.getString('role')
    if (userRole === 'consulta') {
      return e.json(403, {
        success: false,
        error:
          'Acesso negado: usuários com perfil Consulta não possuem permissão para disparar ou reprocessar comunicações.',
      })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const campanhaId = body.campanhaId || ''
    const envioId = body.envioId || ''

    let campanhas = []
    if (envioId) {
      try {
        const envioAlvo = $app.findRecordById('envios', envioId)
        const cId = envioAlvo.getString('campanha')
        if (cId) {
          const cRec = $app.findRecordById('campanhas', cId)
          campanhas = [cRec]
        }
      } catch (errAlvo) {
        return e.json(404, { success: false, error: 'Envio não encontrado: ' + errAlvo })
      }
    } else if (campanhaId) {
      try {
        const cRec = $app.findRecordById('campanhas', campanhaId)
        campanhas = [cRec]
      } catch (_) {
        campanhas = $app.findRecordsByFilter('campanhas', 'id = {:campId}', 'created', 1, 0, {
          campId: campanhaId,
        })
      }
    } else {
      campanhas = $app.findRecordsByFilter('campanhas', "status = 'Enviando'", 'created', 10, 0)
    }

    let totalProcessados = 0
    let totalErros = 0
    let ultimoStatus = ''
    let ultimaMensagemErro = ''

    // Verificar se existe SMTP real configurado no ambiente
    const smtpHost = $os.getenv('SMTP_HOST') || ''
    const smtpPort = parseInt($os.getenv('SMTP_PORT') || '587', 10)
    const smtpUser = $os.getenv('SMTP_USER') || $os.getenv('SMTP_USERNAME') || ''
    const smtpPass = $os.getenv('SMTP_PASS') || $os.getenv('SMTP_PASSWORD') || ''
    const smtpFromEnv = $os.getenv('SMTP_FROM') || 'nao-responda@rolanddg.com.br'
    const hasSmtpConfig = !!(smtpHost && smtpHost.length > 2)

    // Porta 465 = TLS implícito desde o primeiro byte (direct SSL/TLS).
    // Qualquer outra porta (587 em particular) = Plaintext + STARTTLS.
    // No MailYak/PocketBase, settings.smtp.tls = false conecta em texto puro e emite STARTTLS.
    const isImplicitTLS = smtpPort === 465

    for (let c = 0; c < campanhas.length; c++) {
      const camp = campanhas[c]
      let enviosPendentes = []

      if (envioId) {
        try {
          const rec = $app.findRecordById('envios', envioId)
          if (rec.getString('status') === 'Pendente') {
            enviosPendentes = [rec]
          }
        } catch (_) {}
      } else {
        enviosPendentes = $app.findRecordsByFilter(
          'envios',
          "campanha = {:campanhaId} && status = 'Pendente'",
          'created',
          200,
          0,
          { campanhaId: camp.id },
        )
      }

      const campAssunto = camp.getString('assunto') || 'Comunicado'
      const campCorpo = camp.getString('corpo') || ''
      const senderAddress =
        smtpFromEnv || camp.getString('remetente') || 'nao-responda@rolanddg.com.br'
      const replyToAddress = camp.getString('remetente') || senderAddress

      for (let i = 0; i < enviosPendentes.length; i++) {
        const envio = enviosPendentes[i]
        const email = envio.getString('email_utilizado')

        if (!email || email.indexOf('@') === -1) {
          envio.set('status', 'Erro')
          envio.set('erro', true)
          envio.set('sucesso', false)
          envio.set('mensagem_erro', 'E-mail de destino ausente ou inválido')
          envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
          $app.save(envio)
          totalErros++
          continue
        }

        // Buscar dados do contato e da revenda para resolver placeholders {{nome}} e {{revenda}}
        let nomeContato = 'Prezado(a)'
        let nomeRevenda = 'sua empresa'
        try {
          const contatoId = envio.getString('contato')
          if (contatoId) {
            const recContato = $app.findRecordById('contatos', contatoId)
            nomeContato = recContato.getString('nome') || nomeContato
          }
          const revendaId = envio.getString('revenda')
          if (revendaId) {
            const recRevenda = $app.findRecordById('revendas', revendaId)
            nomeRevenda = recRevenda.getString('nome') || nomeRevenda
          }
        } catch (_) {}

        // Resolver mensagem personalizada
        let corpoFinal = campCorpo
        while (corpoFinal.indexOf('{{nome}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{nome}}', nomeContato)
        }
        while (corpoFinal.indexOf('{{revenda}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{revenda}}', nomeRevenda)
        }

        if (hasSmtpConfig) {
          // ENVIO REAL VIA SMTP POCKETBASE
          try {
            // Assegura configurações SMTP temporariamente no settings
            const settings = $app.settings()
            settings.smtp.enabled = true
            settings.smtp.host = smtpHost
            settings.smtp.port = smtpPort
            settings.smtp.username = smtpUser
            settings.smtp.password = smtpPass
            // Autenticação SMTP: Microsoft 365 (smtp.office365.com) não aceita AUTH PLAIN (erro 5.7.4),
            // aceitando apenas AUTH LOGIN ou XOAUTH2. Configuramos explicitamente 'LOGIN' em settings e no mailClient.
            settings.smtp.authMethod = 'LOGIN'
            // Se porta 465 -> TLS implícito (true).
            // Se porta 587 (ou outra) -> Plaintext inicial + STARTTLS obrigatório (false).
            settings.smtp.tls = isImplicitTLS
            settings.meta.senderAddress = senderAddress
            settings.meta.senderName = 'Roland DG Brasil'

            const mailClient = $app.newMailClient()
            mailClient.authMethod = 'LOGIN'
            const msgHeaders = {}
            if (replyToAddress && replyToAddress !== senderAddress) {
              msgHeaders['Reply-To'] = replyToAddress
            }

            const msg = new MailerMessage({
              from: {
                address: senderAddress,
                name: 'Roland DG Brasil',
              },
              to: [{ address: email }],
              subject: campAssunto,
              html: corpoFinal.replace(/\n/g, '<br/>'),
              headers: msgHeaders,
            })

            mailClient.send(msg)

            envio.set('status', 'Enviado')
            envio.set('sucesso', true)
            envio.set('erro', false)
            envio.set('mensagem_erro', '')
            envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
            $app.save(envio)
            totalProcessados++
            ultimoStatus = 'Enviado'
            ultimaMensagemErro = ''
          } catch (sendErr) {
            envio.set('status', 'Erro')
            envio.set('erro', true)
            envio.set('sucesso', false)
            envio.set('mensagem_erro', 'Falha ao entregar SMTP: ' + sendErr)
            envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
            $app.save(envio)
            totalErros++
            ultimoStatus = 'Erro'
            ultimaMensagemErro = 'Falha ao entregar SMTP: ' + sendErr
          }
        } else {
          // ENVIO SIMULADO COM REGISTRO AUDITÁVEL
          envio.set('status', 'Enviado')
          envio.set('sucesso', true)
          envio.set('erro', false)
          envio.set(
            'mensagem_erro',
            'Simulado — nenhum e-mail enviado de fato (SMTP não configurado)',
          )
          envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
          $app.save(envio)
          totalProcessados++
          ultimoStatus = 'Enviado'
          ultimaMensagemErro = 'Simulado — nenhum e-mail enviado de fato (SMTP não configurado)'
        }
      }

      const restantesApos = $app.findRecordsByFilter(
        'envios',
        "campanha = {:campanhaId} && status = 'Pendente'",
        'created',
        1,
        0,
        { campanhaId: camp.id },
      )
      if (restantesApos.length === 0) {
        camp.set('status', 'Concluida')
        $app.save(camp)
      }
    }

    return e.json(200, {
      success: true,
      mode: hasSmtpConfig ? 'real' : 'simulado',
      totalProcessados: totalProcessados,
      totalErros: totalErros,
      campanhasAvaliadas: campanhas.length,
      ultimoStatus: ultimoStatus,
      ultimaMensagemErro: ultimaMensagemErro,
    })
  },
  $apis.requireAuth(),
)

// Endpoint de diagnóstico da configuração de e-mail (usado pelo cabeçalho da tela de Comunicações)
routerAdd(
  'GET',
  '/backend/v1/email-config',
  (e) => {
    const smtpHost = $os.getenv('SMTP_HOST') || ''
    const smtpPort = $os.getenv('SMTP_PORT') || '587'
    const smtpUser = $os.getenv('SMTP_USER') || $os.getenv('SMTP_USERNAME') || ''
    const smtpPass = $os.getenv('SMTP_PASS') || $os.getenv('SMTP_PASSWORD') || ''
    const defaultSender = $os.getenv('SMTP_FROM') || 'nao-responda@rolanddg.com.br'
    const configured = !!(smtpHost && smtpHost.length > 2)

    return e.json(200, {
      mode: configured ? 'real' : 'simulado',
      configured: configured,
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      authMethod: 'LOGIN',
      defaultSender: defaultSender,
      hasPassword: !!smtpPass,
      message: configured
        ? 'SMTP Corporativo configurado (' + smtpHost + ':' + smtpPort + ' [AUTH LOGIN])'
        : 'Modo Simulado ativo: Nenhum e-mail real sai para a internet.',
    })
  },
  $apis.requireAuth(),
)
