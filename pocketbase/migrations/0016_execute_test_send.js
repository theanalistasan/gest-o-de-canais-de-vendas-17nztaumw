migrate(
  (app) => {
    const smtpHost = $os.getenv('SMTP_HOST') || ''
    const smtpPort = parseInt($os.getenv('SMTP_PORT') || '587', 10)
    const smtpUser = $os.getenv('SMTP_USER') || $os.getenv('SMTP_USERNAME') || ''
    const smtpPass = $os.getenv('SMTP_PASS') || $os.getenv('SMTP_PASSWORD') || ''
    const smtpFromEnv = $os.getenv('SMTP_FROM') || 'nao-responda@rolanddg.com.br'
    const isImplicitTLS = smtpPort === 465

    const settings = app.settings()
    settings.smtp.enabled = true
    settings.smtp.host = smtpHost
    settings.smtp.port = smtpPort
    settings.smtp.username = smtpUser
    settings.smtp.password = smtpPass
    settings.smtp.authMethod = 'LOGIN'
    settings.smtp.tls = isImplicitTLS
    settings.meta.senderAddress = smtpFromEnv
    settings.meta.senderName = 'Roland DG Brasil'

    const mailClient = app.newMailClient()
    mailClient.authMethod = 'LOGIN'

    const msg = new MailerMessage({
      from: {
        address: smtpFromEnv,
        name: 'Roland DG Brasil',
      },
      to: [{ address: 'ANALISTASAN@OUTLOOK.COM' }],
      subject: 'Programa de Recomensas',
      html: 'Olá Sandro, Estamos com um Programa de Recomensas para sua empresa',
    })

    const envio = app.findFirstRecordByData('envios', 'id', '3f6adrn3uie6m57')
    const campanha = app.findFirstRecordByData('campanhas', 'id', 'f4opv2kdwouptx9')

    try {
      mailClient.send(msg)
      envio.set('status', 'Enviado')
      envio.set('sucesso', true)
      envio.set('erro', false)
      envio.set('mensagem_erro', '')
      envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
      app.save(envio)

      campanha.set('status', 'Concluida')
      app.save(campanha)
    } catch (err) {
      envio.set('status', 'Erro')
      envio.set('erro', true)
      envio.set('sucesso', false)
      envio.set('mensagem_erro', 'Falha ao entregar SMTP: ' + err)
      envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
      app.save(envio)
    }
  },
  (app) => {},
)
