migrate(
  (app) => {
    const envios = app.findCollectionByNameOrId('envios')
    // Exclusão de envios de auditoria/histórico restrita exclusivamente ao perfil Administrador
    // e apenas para registros que falharam (status = 'Erro')
    envios.deleteRule = "@request.auth.role = 'admin' && status = 'Erro'"
    app.save(envios)
  },
  (app) => {
    try {
      const envios = app.findCollectionByNameOrId('envios')
      envios.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'gestor'"
      app.save(envios)
    } catch (_) {}
  },
)
