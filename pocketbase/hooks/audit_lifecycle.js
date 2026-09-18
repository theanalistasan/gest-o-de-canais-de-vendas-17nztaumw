// Hook para auditoria automática de criação, atualização e exclusão
// Collections auditadas: revendas, contatos, campanhas, envios, users

onRecordAfterCreateSuccess(
  (e) => {
    try {
      const auditoriaCol = $app.findCollectionByNameOrId('auditoria')
      const auditRecord = new Record(auditoriaCol)

      let userId = ''
      if (e.auth && e.auth.id) {
        userId = e.auth.id
      }

      auditRecord.set('acao', 'CRIAR')
      auditRecord.set('registro', e.record.collection().name + '/' + e.record.id)
      if (userId) {
        auditRecord.set('usuario', userId)
      }
      auditRecord.set('valor_anterior', null)
      auditRecord.set('novo_valor', e.record.publicExport())
      $app.save(auditRecord)
    } catch (err) {
      console.log('Erro ao auditar criacao: ' + err)
    }
    e.next()
  },
  'revendas',
  'contatos',
  'campanhas',
  'envios',
  'users',
)

onRecordAfterUpdateSuccess(
  (e) => {
    try {
      const auditoriaCol = $app.findCollectionByNameOrId('auditoria')
      const auditRecord = new Record(auditoriaCol)

      let userId = ''
      if (e.auth && e.auth.id) {
        userId = e.auth.id
      }

      auditRecord.set('acao', 'EDITAR')
      auditRecord.set('registro', e.record.collection().name + '/' + e.record.id)
      if (userId) {
        auditRecord.set('usuario', userId)
      }

      let originalVal = null
      if (e.record.original()) {
        originalVal = e.record.original().publicExport()
      }

      auditRecord.set('valor_anterior', originalVal)
      auditRecord.set('novo_valor', e.record.publicExport())
      $app.save(auditRecord)
    } catch (err) {
      console.log('Erro ao auditar atualizacao: ' + err)
    }
    e.next()
  },
  'revendas',
  'contatos',
  'campanhas',
  'envios',
  'users',
)

onRecordAfterDeleteSuccess(
  (e) => {
    try {
      const auditoriaCol = $app.findCollectionByNameOrId('auditoria')
      const auditRecord = new Record(auditoriaCol)

      let userId = ''
      if (e.auth && e.auth.id) {
        userId = e.auth.id
      }

      auditRecord.set('acao', 'EXCLUIR')
      auditRecord.set('registro', e.record.collection().name + '/' + e.record.id)
      if (userId) {
        auditRecord.set('usuario', userId)
      }
      auditRecord.set('valor_anterior', e.record.publicExport())
      auditRecord.set('novo_valor', null)
      $app.save(auditRecord)
    } catch (err) {
      console.log('Erro ao auditar exclusao: ' + err)
    }
    e.next()
  },
  'revendas',
  'contatos',
  'campanhas',
  'envios',
  'users',
)
