migrate(
  (app) => {
    // 0038_sanitize_fechamento_and_templates.js
    // Higieniza registros persistidos em email_templates e campanhas
    // que possam conter referências antigas a "Olá teste" ou "ola teste" no fechamento/rodapé
    try {
      const templates = app.findRecordsByFilter('email_templates', 'id != ""', 'created', 500, 0)
      for (let i = 0; i < templates.length; i++) {
        const tmpl = templates[i]
        const corpo = tmpl.getString('corpo') || ''
        if (
          corpo.indexOf('Olá teste') !== -1 ||
          corpo.indexOf('ola teste') !== -1 ||
          corpo.indexOf('Olá Teste') !== -1
        ) {
          const novoCorpo = corpo
            .replace(/Olá teste/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
          tmpl.set('corpo', novoCorpo)
          app.save(tmpl)
        }
      }
    } catch (err) {
      console.log('Erro ao higienizar email_templates: ' + err)
    }

    try {
      const campanhas = app.findRecordsByFilter('campanhas', 'id != ""', 'created', 500, 0)
      for (let j = 0; j < campanhas.length; j++) {
        const camp = campanhas[j]
        const corpoCamp = camp.getString('corpo') || ''
        if (
          corpoCamp.indexOf('Olá teste') !== -1 ||
          corpoCamp.indexOf('ola teste') !== -1 ||
          corpoCamp.indexOf('Olá Teste') !== -1
        ) {
          const novoCorpoCamp = corpoCamp
            .replace(/Olá teste/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
          camp.set('corpo', novoCorpoCamp)
          app.save(camp)
        }
      }
    } catch (err2) {
      console.log('Erro ao higienizar campanhas: ' + err2)
    }
  },
  (app) => {
    // Migração de dados de higienização irreversível por segurança
  },
)
