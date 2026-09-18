migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const revendas = app.findCollectionByNameOrId('revendas')
    const contatos = app.findCollectionByNameOrId('contatos')

    // Collection: campanhas
    const campanhas = new Collection({
      name: 'campanhas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'assunto', type: 'text', required: true },
        { name: 'corpo', type: 'editor', required: true },
        { name: 'remetente', type: 'text', required: true },
        {
          name: 'tipo_envio',
          type: 'select',
          required: true,
          values: ['Teste', 'Producao'],
          maxSelect: 1,
        },
        { name: 'intervalo_segundos', type: 'number', required: true },
        { name: 'quantidade_destinatarios', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Rascunho', 'Agendada', 'Enviando', 'Concluida', 'Cancelada', 'Erro'],
          maxSelect: 1,
        },
        {
          name: 'usuario',
          type: 'relation',
          required: true,
          collectionId: users.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campanhas_status ON campanhas (status)',
        'CREATE INDEX idx_campanhas_usuario ON campanhas (usuario)',
      ],
    })
    app.save(campanhas)

    // Collection: envios
    const envios = new Collection({
      name: 'envios',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      fields: [
        {
          name: 'campanha',
          type: 'relation',
          required: true,
          collectionId: campanhas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contato',
          type: 'relation',
          required: true,
          collectionId: contatos.id,
          maxSelect: 1,
        },
        {
          name: 'revenda',
          type: 'relation',
          required: true,
          collectionId: revendas.id,
          maxSelect: 1,
        },
        { name: 'email_utilizado', type: 'email', required: false },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Enviado', 'Erro', 'Cancelado'],
          maxSelect: 1,
        },
        { name: 'data_envio', type: 'date', required: false },
        { name: 'sucesso', type: 'bool', required: false },
        { name: 'erro', type: 'bool', required: false },
        { name: 'mensagem_erro', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_envios_campanha ON envios (campanha)',
        'CREATE INDEX idx_envios_contato ON envios (contato)',
        'CREATE INDEX idx_envios_revenda ON envios (revenda)',
        'CREATE INDEX idx_envios_status ON envios (status)',
        'CREATE INDEX idx_envios_data_envio ON envios (data_envio)',
      ],
    })
    app.save(envios)

    // Collection: auditoria
    const auditoria = new Collection({
      name: 'auditoria',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null, // Superuser/hook only
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'usuario',
          type: 'relation',
          required: false,
          collectionId: users.id,
          maxSelect: 1,
        },
        { name: 'acao', type: 'text', required: true },
        { name: 'data_hora', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'registro', type: 'text', required: true },
        { name: 'valor_anterior', type: 'json', required: false },
        { name: 'novo_valor', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_auditoria_usuario ON auditoria (usuario)',
        'CREATE INDEX idx_auditoria_registro ON auditoria (registro)',
        'CREATE INDEX idx_auditoria_acao ON auditoria (acao)',
      ],
    })
    app.save(auditoria)
  },
  (app) => {
    try {
      const auditoria = app.findCollectionByNameOrId('auditoria')
      app.delete(auditoria)
    } catch (_) {}
    try {
      const envios = app.findCollectionByNameOrId('envios')
      app.delete(envios)
    } catch (_) {}
    try {
      const campanhas = app.findCollectionByNameOrId('campanhas')
      app.delete(campanhas)
    } catch (_) {}
  },
)
