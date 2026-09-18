// Endpoint custom: /backend/v1/processar-envios
// Dispara o processamento imediato dos envios pendentes de uma campanha ou de todas
routerAdd(
  'POST',
  '/backend/v1/processar-envios',
  (e) => {
    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const campanhaId = body.campanhaId || ''

    let filter = "status = 'Enviando'"
    if (campanhaId) {
      filter += " && id = '" + campanhaId + "'"
    }

    const campanhas = $app.findRecordsByFilter('campanhas', filter, 'created', 10, 0)
    let totalProcessados = 0
    let totalErros = 0

    for (let c = 0; c < campanhas.length; c++) {
      const camp = campanhas[c]
      const enviosPendentes = $app.findRecordsByFilter(
        'envios',
        "campanha = '" + camp.id + "' && status = 'Pendente'",
        'created',
        200,
        0,
      )

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
        } else {
          envio.set('status', 'Enviado')
          envio.set('sucesso', true)
          envio.set('erro', false)
          envio.set('mensagem_erro', '')
          envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
          $app.save(envio)
          totalProcessados++
        }
      }

      const restantesApos = $app.countRecords(
        'envios',
        "campanha = '" + camp.id + "' && status = 'Pendente'",
      )
      if (restantesApos === 0) {
        camp.set('status', 'Concluida')
        $app.save(camp)
      }
    }

    return e.json(200, {
      success: true,
      totalProcessados: totalProcessados,
      totalErros: totalErros,
      campanhasAvaliadas: campanhas.length,
    })
  },
  $apis.requireAuth(),
)
