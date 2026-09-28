migrate(
  (app) => {
    // 1. Adicionar campo 'meta' na collection 'revendas'
    const revendas = app.findCollectionByNameOrId('revendas')
    if (!revendas.fields.getByName('meta')) {
      revendas.fields.add(
        new NumberField({
          name: 'meta',
          min: 0,
          required: false,
        }),
      )
      app.save(revendas)
    }

    // 2. Adicionar campo 'anexos' na collection 'campanhas'
    const campanhas = app.findCollectionByNameOrId('campanhas')
    if (!campanhas.fields.getByName('anexos')) {
      campanhas.fields.add(
        new FileField({
          name: 'anexos',
          maxSelect: 5,
          maxSize: 10485760, // 10MB em bytes (10 * 1024 * 1024)
          mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/png',
            'image/jpeg',
          ],
          required: false,
        }),
      )
      app.save(campanhas)
    }
  },
  (app) => {
    try {
      const revendas = app.findCollectionByNameOrId('revendas')
      const metaField = revendas.fields.getByName('meta')
      if (metaField) {
        revendas.fields.removeByName('meta')
        app.save(revendas)
      }
    } catch (_) {}

    try {
      const campanhas = app.findCollectionByNameOrId('campanhas')
      const anexosField = campanhas.fields.getByName('anexos')
      if (anexosField) {
        campanhas.fields.removeByName('anexos')
        app.save(campanhas)
      }
    } catch (_) {}
  },
)
