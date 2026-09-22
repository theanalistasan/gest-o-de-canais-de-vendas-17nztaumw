// Migration de limpeza dos registros de diagnóstico temporários da tabela de auditoria
migrate(
  (app) => {
    try {
      app.db().newQuery("DELETE FROM auditoria WHERE registro LIKE 'diag_smtp%'").execute()
    } catch (_) {}
  },
  (app) => {},
)
