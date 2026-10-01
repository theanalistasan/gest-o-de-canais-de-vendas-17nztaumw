migrate(
  (app) => {
    // 0037_fix_envios_snapshot_and_corpo.js
    // 1. Corrige dados existentes na collection 'envios':
    // Se algum registro de envio tiver contato ou revenda com snapshot errado ou nulo,
    // atualiza com os dados reais do contato e revenda associados.
    // Especialmente para Silvio / Roland DG Brasil.
    try {
      const envios = app.findRecordsByFilter('envios', 'id != ""', 'created', 500, 0)
      for (let i = 0; i < envios.length; i++) {
        const envio = envios[i]
        const contatoId = envio.getString('contato')
        const revendaId = envio.getString('revenda')
        let modified = false

        if (contatoId) {
          try {
            const contato = app.findRecordById('contatos', contatoId)
            const nomeContatoReal = contato.getString('nome')
            if (nomeContatoReal && envio.getString('nome_contato') !== nomeContatoReal) {
              envio.set('nome_contato', nomeContatoReal)
              modified = true
            }
          } catch (_) {}
        }

        if (revendaId) {
          try {
            const revenda = app.findRecordById('revendas', revendaId)
            const nomeRevendaReal = revenda.getString('nome')
            const codigoRevendaReal = revenda.getString('codigo')
            if (nomeRevendaReal && envio.getString('nome_revenda') !== nomeRevendaReal) {
              envio.set('nome_revenda', nomeRevendaReal)
              modified = true
            }
            if (codigoRevendaReal && envio.getString('codigo_revenda') !== codigoRevendaReal) {
              envio.set('codigo_revenda', codigoRevendaReal)
              modified = true
            }
          } catch (_) {}
        }

        if (modified) {
          app.save(envio)
        }
      }
    } catch (err) {
      console.log('Erro na migracao 0037_fix_envios_snapshot_and_corpo: ' + err)
    }
  },
  (app) => {
    // Reversão preservativa
  },
)
