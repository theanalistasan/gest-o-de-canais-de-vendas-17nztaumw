migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('auditoria')
    const rec = new Record(auditCol)

    let sKeys = []
    let sSmtp = {}
    try {
      const s = app.settings()
      sKeys = Object.keys(s.smtp)
      sSmtp = {
        enabled: s.smtp.enabled,
        port: s.smtp.port,
        host: s.smtp.host,
        username: s.smtp.username,
        tls: s.smtp.tls,
        authMethod: s.smtp.authMethod !== undefined ? s.smtp.authMethod : 'NOT_DEFINED',
      }
    } catch (e) {
      sSmtp = { err: '' + e }
    }

    rec.set('acao', 'PROBE_3')
    rec.set('registro', 'diag_smtp_3')
    rec.set('novo_valor', {
      smtpKeys: sKeys,
      smtpSummary: sSmtp,
    })
    app.save(rec)
  },
  (app) => {},
)
