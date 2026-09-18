migrate(
  (app) => {
    const segmentos = app.findCollectionByNameOrId('segmentos')
    const statusRevenda = app.findCollectionByNameOrId('status_revenda')
    const insideSales = app.findCollectionByNameOrId('inside_sales')
    const responsaveis = app.findCollectionByNameOrId('responsaveis')
    const canais = app.findCollectionByNameOrId('canais_faturamento')
    const estados = app.findCollectionByNameOrId('estados')
    const cargos = app.findCollectionByNameOrId('cargos')

    // Collection: revendas
    const revendas = new Collection({
      name: 'revendas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      fields: [
        { name: 'codigo', type: 'text', required: false },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'segmento',
          type: 'relation',
          required: true,
          collectionId: segmentos.id,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'relation',
          required: true,
          collectionId: statusRevenda.id,
          maxSelect: 1,
        },
        {
          name: 'inside_sales',
          type: 'relation',
          required: false,
          collectionId: insideSales.id,
          maxSelect: 1,
        },
        {
          name: 'responsavel',
          type: 'relation',
          required: false,
          collectionId: responsaveis.id,
          maxSelect: 1,
        },
        {
          name: 'canal_faturamento',
          type: 'relation',
          required: false,
          collectionId: canais.id,
          maxSelect: 1,
        },
        {
          name: 'estado',
          type: 'relation',
          required: false,
          collectionId: estados.id,
          maxSelect: 1,
        },
        { name: 'cidade', type: 'text', required: false },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_revendas_codigo ON revendas (codigo) WHERE codigo IS NOT NULL AND codigo != ''",
        'CREATE INDEX idx_revendas_nome ON revendas (nome)',
        'CREATE INDEX idx_revendas_segmento ON revendas (segmento)',
        'CREATE INDEX idx_revendas_status ON revendas (status)',
        'CREATE INDEX idx_revendas_inside ON revendas (inside_sales)',
        'CREATE INDEX idx_revendas_responsavel ON revendas (responsavel)',
        'CREATE INDEX idx_revendas_canal ON revendas (canal_faturamento)',
        'CREATE INDEX idx_revendas_estado ON revendas (estado)',
      ],
    })
    app.save(revendas)

    // Collection: contatos
    const contatos = new Collection({
      name: 'contatos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      fields: [
        {
          name: 'revenda',
          type: 'relation',
          required: true,
          collectionId: revendas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'cargo',
          type: 'relation',
          required: false,
          collectionId: cargos.id,
          maxSelect: 1,
        },
        { name: 'email', type: 'email', required: false },
        { name: 'email_secundario', type: 'email', required: false },
        { name: 'telefone', type: 'text', required: false },
        { name: 'celular', type: 'text', required: false },
        { name: 'whatsapp', type: 'text', required: false },
        { name: 'estado_regiao', type: 'text', required: false },
        { name: 'contato_principal', type: 'bool', required: false },
        { name: 'recebe_comunicacoes', type: 'bool', required: false },
        { name: 'observacoes', type: 'text', required: false },
        {
          name: 'status_contato',
          type: 'select',
          required: false,
          values: ['Ativo', 'Inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contatos_revenda ON contatos (revenda)',
        'CREATE INDEX idx_contatos_nome ON contatos (nome)',
        'CREATE INDEX idx_contatos_email ON contatos (email)',
        'CREATE INDEX idx_contatos_cargo ON contatos (cargo)',
        'CREATE INDEX idx_contatos_principal ON contatos (contato_principal)',
        'CREATE INDEX idx_contatos_recebe ON contatos (recebe_comunicacoes)',
        'CREATE INDEX idx_contatos_status ON contatos (status_contato)',
      ],
    })
    app.save(contatos)
  },
  (app) => {
    try {
      const contatos = app.findCollectionByNameOrId('contatos')
      app.delete(contatos)
    } catch (_) {}
    try {
      const revendas = app.findCollectionByNameOrId('revendas')
      app.delete(revendas)
    } catch (_) {}
  },
)
