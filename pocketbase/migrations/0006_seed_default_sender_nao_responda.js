migrate(
  (app) => {
    const colRemetentes = app.findCollectionByNameOrId('remetentes')

    // Verificar se nao-responda@rolanddg.com.br já existe
    try {
      app.findFirstRecordByData('remetentes', 'email', 'nao-responda@rolanddg.com.br')
    } catch (_) {
      const record = new Record(colRemetentes)
      record.set('nome', 'Roland DG Brasil (Não Responda)')
      record.set('email', 'nao-responda@rolanddg.com.br')
      app.save(record)
    }

    // Verificar se comunicados@rolanddg.com.br também existe como remetente autorizado
    try {
      app.findFirstRecordByData('remetentes', 'email', 'comunicados@rolanddg.com.br')
    } catch (_) {
      const record = new Record(colRemetentes)
      record.set('nome', 'Roland DG Brasil - Comunicações')
      record.set('email', 'comunicados@rolanddg.com.br')
      app.save(record)
    }
  },
  (app) => {
    // down: opcionalmente remove o remetente seed se desejado
    try {
      const rec = app.findFirstRecordByData('remetentes', 'email', 'nao-responda@rolanddg.com.br')
      app.delete(rec)
    } catch (_) {}
  },
)
