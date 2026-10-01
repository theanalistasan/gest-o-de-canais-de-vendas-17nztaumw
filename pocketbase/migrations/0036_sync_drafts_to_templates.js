migrate(
  (app) => {
    // 1. Migrar rascunhos antigos da collection 'campanhas' para 'email_templates' (se ainda não existirem)
    try {
      const rascunhos = app.findRecordsByFilter(
        'campanhas',
        "status = 'Rascunho'",
        'created',
        100,
        0,
      )
      const templatesCol = app.findCollectionByNameOrId('email_templates')

      for (let i = 0; i < rascunhos.length; i++) {
        const r = rascunhos[i]
        const nomeOriginal = r.getString('nome') || `Modelo ${r.id}`
        const assunto = r.getString('assunto') || 'Sem assunto'
        const corpo = r.getString('corpo') || ''

        // Verificar se já existe template com esse nome
        let nomeFinal = nomeOriginal
        try {
          app.findFirstRecordByData('email_templates', 'nome', nomeFinal)
          nomeFinal = `${nomeOriginal} (${r.id.substring(0, 4)})`
        } catch (_) {}

        try {
          const rec = new Record(templatesCol)
          rec.set('nome', nomeFinal)
          rec.set('assunto', assunto)
          rec.set('corpo', corpo)
          app.save(rec)
        } catch (saveErr) {
          console.log('Erro ao migrar rascunho para template: ' + saveErr)
        }
      }
    } catch (err) {
      console.log('Erro na migracao 0036_sync_drafts_to_templates: ' + err)
    }
  },
  (app) => {
    // Idempotente / preservativo — não remove templates
  },
)
