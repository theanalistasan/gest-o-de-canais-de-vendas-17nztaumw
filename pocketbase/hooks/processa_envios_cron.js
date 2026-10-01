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

        let nomeContato = envio.getString('nome_contato')
        let nomeRevenda = envio.getString('nome_revenda')
        try {
          if (!nomeContato) {
            const contatoId = envio.getString('contato')
            if (contatoId) {
              const recContato = $app.findRecordById('contatos', contatoId)
              nomeContato = recContato.getString('nome') || ''
            }
          }
          if (!nomeRevenda) {
            const revendaId = envio.getString('revenda')
            if (revendaId) {
              const recRevenda = $app.findRecordById('revendas', revendaId)
              nomeRevenda = recRevenda.getString('nome') || ''
            }
          }
        } catch (_) {}
        if (!nomeContato) nomeContato = 'Prezado(a)'
        if (!nomeRevenda) nomeRevenda = 'sua empresa'

        let corpoFinal = campCorpo
        while (corpoFinal.indexOf('{{nome}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{nome}}', nomeContato)
        }
        while (corpoFinal.indexOf('{{revenda}}') !== -1) {
          corpoFinal = corpoFinal.replace('{{revenda}}', nomeRevenda)
        }

        // Montar HTML padrão com cabeçalho oficial Roland DG e rodapé responsivo
        const logoUrl =
          (
            $os.getenv('PB_INSTANCE_URL') ||
            $os.getenv('SITE_URL') ||
            'https://gestao-de-canais-de-vendas-afa89.shrd00.internal.goskip.dev'
          ).replace(/\/$/, '') + '/backend/v1/roland-logo.png'

        // Detectar se já tem estrutura HTML completa
        let htmlFinal = ''
        if (corpoFinal.indexOf('<!DOCTYPE') !== -1 || corpoFinal.indexOf('<html') !== -1) {
          htmlFinal = corpoFinal
        } else {
          const corpoFormatado = corpoFinal.replace(/\n/g, '<br/>')
          const defaultFechamento =
            'Departamento Comercial<br/><br/>Roland DG Brasil Imp e Exp Ltda<br/>Rua San Jose, nº 780 - Pq Industrial San Jose<br/>CEP 06715-862 - (11) 3500-2600 Opção 1'

          htmlFinal =
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">' +
            '<head>' +
            '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
            '<title>Roland DG Brasil</title>' +
            '</head>' +
            '<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">' +
            '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;padding:24px 12px;">' +
            '<tr><td align="center">' +
            '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">' +
            '<!-- Header com Logo Roland DG -->' +
            '<tr><td style="padding:28px 32px 20px 32px;border-bottom:2px solid #005696;">' +
            '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>' +
            '<td align="left" valign="middle">' +
            '<img src="' +
            logoUrl +
            '" alt="Roland DG Brasil" width="340" style="display:block;width:340px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#005696;" />' +
            '</td>' +
            '<td align="right" valign="middle" style="font-size:11px;color:#64748b;font-family:Arial,sans-serif;">Comunicação Oficial</td>' +
            '</tr></table>' +
            '</td></tr>' +
            '<!-- Corpo -->' +
            '<tr><td style="padding:32px;font-size:14px;line-height:1.65;color:#334155;">' +
            corpoFormatado +
            '</td></tr>' +
            '<!-- Fechamento fixo Roland DG -->' +
            '<tr><td style="padding:0 32px 28px 32px;">' +
            '<div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:13px;line-height:1.6;color:#475569;">' +
            defaultFechamento +
            '</div>' +
            '</td></tr>' +
            '<!-- Rodape -->' +
            '<tr><td style="padding:16px 32px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;line-height:1.5;">' +
            'Roland DG Brasil &bull; Todos os direitos reservados.<br />Mensagem automática enviada através do canal autorizado.' +
            '</td></tr>' +
            '</table>' +
            '</td></tr></table>' +
            '</body></html>'
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
              html: htmlFinal,
              headers: msgHeaders,
              attachments: {},
            })

            // Anexos da campanha via filesystem
            let fsys = null
            const openedFiles = []
            try {
              let anexosNomes = []
              try {
                anexosNomes = camp.getStringSlice('anexos') || []
              } catch (_) {
                const single = camp.getString('anexos')
                if (single) anexosNomes = [single]
              }

              if (anexosNomes && anexosNomes.length > 0) {
                fsys = $app.newFilesystem()
                const basePath = camp.baseFilesPath()
                for (let a = 0; a < anexosNomes.length; a++) {
                  const nomeArquivo = anexosNomes[a]
                  if (!nomeArquivo) continue
                  try {
                    const fileKey = basePath + '/' + nomeArquivo
                    const reader = fsys.getFile(fileKey)
                    if (reader) {
                      openedFiles.push(reader)
                      msg.attachments[nomeArquivo] = reader
                    }
                  } catch (attachErr) {
                    console.log('Erro ao anexar arquivo ' + nomeArquivo + ': ' + attachErr)
                  }
                }
              }

              mailClient.send(msg)
            } finally {
              for (let o = 0; o < openedFiles.length; o++) {
                try {
                  openedFiles[o].close()
                } catch (_) {}
              }
              if (fsys) {
                try {
                  fsys.close()
                } catch (_) {}
              }
            }

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
