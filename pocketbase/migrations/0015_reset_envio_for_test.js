migrate(
  (app) => {
    // Configurar o envio com erro para 'Pendente' e a campanha para 'Enviando'
    // para que o endpoint ou cron possa reprocessar
    try {
      const envio = app.findFirstRecordByData('envios', 'id', '3f6adrn3uie6m57')
      envio.set('status', 'Pendente')
      envio.set('erro', false)
      envio.set('sucesso', false)
      envio.set('mensagem_erro', '')
      app.save(envio)

      const campanha = app.findFirstRecordByData('campanhas', 'id', 'f4opv2kdwouptx9')
      campanha.set('status', 'Enviando')
      app.save(campanha)
    } catch (err) {
      console.log('Erro ao resetar envio para teste: ' + err)
    }
  },
  (app) => {},
)
