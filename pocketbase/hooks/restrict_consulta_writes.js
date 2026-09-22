// Hooks para segurança estrita e bloqueio de escrita para o perfil 'consulta'
// Garante no nível de aplicação que usuários com role 'consulta' nunca criem, atualizem ou excluam registros

onRecordCreateRequest(
  (e) => {
    const auth = e.auth
    if (auth && auth.getString('role') === 'consulta') {
      throw new ForbiddenError(
        'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode criar registros.',
      )
    }
    e.next()
  },
  'campanhas',
  'envios',
  'revendas',
  'contatos',
  'users',
  'segmentos',
  'inside_sales',
  'responsaveis',
  'canais_faturamento',
  'cargos',
  'estados',
  'status_revenda',
  'remetentes',
  'email_templates',
)

onRecordUpdateRequest(
  (e) => {
    const auth = e.auth
    if (auth && auth.getString('role') === 'consulta') {
      throw new ForbiddenError(
        'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode atualizar registros.',
      )
    }
    e.next()
  },
  'campanhas',
  'envios',
  'revendas',
  'contatos',
  'users',
  'segmentos',
  'inside_sales',
  'responsaveis',
  'canais_faturamento',
  'cargos',
  'estados',
  'status_revenda',
  'remetentes',
  'email_templates',
)

onRecordDeleteRequest(
  (e) => {
    const auth = e.auth
    if (auth && auth.getString('role') === 'consulta') {
      throw new ForbiddenError(
        'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode excluir registros.',
      )
    }
    e.next()
  },
  'campanhas',
  'envios',
  'revendas',
  'contatos',
  'users',
  'segmentos',
  'inside_sales',
  'responsaveis',
  'canais_faturamento',
  'cargos',
  'estados',
  'status_revenda',
  'remetentes',
  'email_templates',
)
