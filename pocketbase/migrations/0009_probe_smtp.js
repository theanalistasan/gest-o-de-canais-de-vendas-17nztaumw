migrate(
  (app) => {
    const settings = app.settings()
    // Salvar em um registro para podermos ler via db_query
    const auditCol = app.findCollectionByNameOrId('auditoria')
    const rec = new Record(auditCol)

    let mcMethods = []
    try {
      const mc = app.newMailClient()
      for (let k in mc) {
        mcMethods.push(k)
      }
    } catch (e) {
      mcMethods = ['err: ' + e]
    }

    rec.set('entidade', 'SMTP_PROBE')
    rec.set('acao', 'PROBE')
    rec.set('registro_id', 'diag')
    rec.set('dados_depois', {
      smtpSettings: settings.smtp,
      mcMethods: mcMethods,
      hasSmtpGlobal: typeof $smtp,
      hasMailGlobal: typeof $mail,
      hasNetGlobal: typeof $net,
      hasOsGlobal: typeof $os,
    })
    app.save(rec)
  },
  (app) => {},
)
