// Cron: processa campanhas com status "Enviando"
// Intervalo mínimo de 10 minutos
cronAdd('processa_envios', '*/10 * * * *', () => {
  try {
    const campanhas = $app.findRecordsByFilter('campanhas', "status = 'Enviando'", 'created', 10, 0)

    for (let c = 0; c < campanhas.length; c++) {
      const camp = campanhas[c]
      const enviosPendentes = $app.findRecordsByFilter(
        'envios',
        "campanha = '" + camp.id + "' && status = 'Pendente'",
        'created',
        50,
        0,
      )

      if (enviosPendentes.length === 0) {
        // Todas concluídas ou vazias
        const restantes = $app.countRecords(
          'envios',
          "campanha = '" + camp.id + "' && status = 'Pendente'",
        )
        if (restantes === 0) {
          camp.set('status', 'Concluida')
          $app.save(camp)
        }
        continue
      }

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
        } else {
          // Simulação / Registro de envio individual
          envio.set('status', 'Enviado')
          envio.set('sucesso', true)
          envio.set('erro', false)
          envio.set('mensagem_erro', '')
          envio.set('data_envio', new Date().toISOString().replace('T', ' ').substring(0, 19))
          $app.save(envio)
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
  } catch (err) {
    console.log('Erro cron processa_envios: ' + err)
  }
})
