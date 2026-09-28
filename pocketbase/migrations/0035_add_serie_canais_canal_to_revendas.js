migrate(
  (app) => {
    const revendas = app.findCollectionByNameOrId('revendas')

    if (!revendas.fields.getByName('serie')) {
      revendas.fields.add(
        new TextField({
          name: 'serie',
          required: false,
        }),
      )
    }

    if (!revendas.fields.getByName('canais')) {
      revendas.fields.add(
        new TextField({
          name: 'canais',
          required: false,
        }),
      )
    }

    if (!revendas.fields.getByName('canal')) {
      revendas.fields.add(
        new TextField({
          name: 'canal',
          required: false,
        }),
      )
    }

    app.save(revendas)
  },
  (app) => {
    try {
      const revendas = app.findCollectionByNameOrId('revendas')
      if (revendas.fields.getByName('serie')) {
        revendas.fields.removeByName('serie')
      }
      if (revendas.fields.getByName('canais')) {
        revendas.fields.removeByName('canais')
      }
      if (revendas.fields.getByName('canal')) {
        revendas.fields.removeByName('canal')
      }
      app.save(revendas)
    } catch (_) {}
  },
)
