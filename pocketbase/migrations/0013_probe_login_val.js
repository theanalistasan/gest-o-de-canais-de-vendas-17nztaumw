migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('auditoria')
    const rec = new Record(auditCol)

    let testLoginMethod = null
    let testPlainMethod = null
    let testValidateResult = null

    try {
      const s = app.settings()
      s.smtp.authMethod = 'LOGIN'
      testLoginMethod = s.smtp.authMethod
      try {
        s.smtp.validate()
        testValidateResult = 'valid'
      } catch (vErr) {
        testValidateResult = 'val_err: ' + vErr
      }

      const mc = app.newMailClient()
      mc.authMethod = 'LOGIN'
    } catch (e) {
      testLoginMethod = 'err: ' + e
    }

    rec.set('acao', 'PROBE_4')
    rec.set('registro', 'diag_smtp_4')
    rec.set('novo_valor', {
      testLoginMethod: testLoginMethod,
      testValidateResult: testValidateResult,
    })
    app.save(rec)
  },
  (app) => {},
)
