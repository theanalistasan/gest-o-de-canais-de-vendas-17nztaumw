// Cron: processa campanhas com status "Enviando"
// Intervalo mínimo de 10 minutos
cronAdd('processa_envios', '*/10 * * * *', () => {
  try {
    const campanhas = $app.findRecordsByFilter('campanhas', "status = 'Enviando'", 'created', 10, 0)
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
      const enviosPendentes = $app.findRecordsByFilter(
        'envios',
        "campanha = {:campId} && status = 'Pendente'",
        'created',
        50,
        0,
        { campId: camp.id },
      )

      if (enviosPendentes.length === 0) {
        camp.set('status', 'Concluida')
        $app.save(camp)
        continue
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
          continue
        }

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

        let corpoFinal = campCorpo
        while (corpoFinal.indexOf('{{nome}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{nome}}', nomeContato)
        }
        while (corpoFinal.indexOf('{{revenda}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{revenda}}', nomeRevenda)
        }

        if (hasSmtpConfig) {
          try {
            const settings = $app.settings()
            settings.smtp.enabled = true
            settings.smtp.host = smtpHost
            settings.smtp.port = smtpPort
            settings.smtp.username = smtpUser
            settings.smtp.password = smtpPass
            // Autenticação SMTP: Microsoft 365 (smtp.office365.com) não suporta AUTH PLAIN,
            // exigindo AUTH LOGIN. Fixamos explicitamente 'LOGIN' em settings e no mailClient.
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
          } catch (sendErr) {
            envio.set('status', 'Erro')
            envio.set('erro', true)
            envio.set('sucesso', false)
            envio.set('mensagem_erro', 'Falha ao entregar SMTP: ' + sendErr)
            envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
            $app.save(envio)
          }
        } else {
          envio.set('status', 'Enviado')
          envio.set('sucesso', true)
          envio.set('erro', false)
          envio.set(
            'mensagem_erro',
            'Simulado — nenhum e-mail enviado de fato (SMTP não configurado)',
          )
          envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
          $app.save(envio)
        }
      }

      const restantesApos = $app.findRecordsByFilter(
        'envios',
        "campanha = {:campId} && status = 'Pendente'",
        'created',
        1,
        0,
        { campId: camp.id },
      )
      if (restantesApos.length === 0) {
        camp.set('status', 'Concluida')
        $app.save(camp)
      }
    }
  } catch (err) {
    console.log('Erro cron processa_envios: ' + err)
  }
})
