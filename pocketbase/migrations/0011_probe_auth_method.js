migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('auditoria')
    const rec = new Record(auditCol)

    let mcMethods = []
    let authMethodVal = null
    let settingsSmtp = null
    try {
      const s = app.settings()
      settingsSmtp = s.smtp
      const mc = app.newMailClient()
      mcMethods = Object.keys(mc)
      authMethodVal = mc.authMethod
    } catch (e) {
      mcMethods = ['err: ' + e]
    }

    rec.set('acao', 'PROBE_2')
    rec.set('registro', 'diag_smtp_2')
    rec.set('novo_valor', {
      settingsSmtp: settingsSmtp,
      mcMethods: mcMethods,
      authMethodVal: authMethodVal,
    })
    app.save(rec)
  },
  (app) => {},
)
