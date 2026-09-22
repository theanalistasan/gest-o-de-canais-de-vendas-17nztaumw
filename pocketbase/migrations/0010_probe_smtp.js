migrate(
  (app) => {
    const settings = app.settings()
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

    rec.set('acao', 'PROBE')
    rec.set('registro', 'diag_smtp')
    rec.set('novo_valor', {
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
