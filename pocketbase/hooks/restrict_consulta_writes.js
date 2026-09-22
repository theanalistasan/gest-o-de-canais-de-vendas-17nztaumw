// Hooks para segurança estrita e bloqueio de escrita para os perfis 'consulta' e 'suporte'
// Regras:
// 1. 'consulta': bloqueio total de criação, atualização e exclusão em todas as coleções.
// 2. 'suporte': pode criar e atualizar cadastros (revendas, contatos, tabelas auxiliares),
//    mas NÃO pode:
//    - Criar/atualizar campanhas ou envios (módulo de comunicações bloqueado)
//    - Criar/atualizar remetentes, email_templates ou usuários (administração bloqueada)
//    - Excluir qualquer registro (exclusão bloqueada para suporte)

onRecordCreateRequest(
  (e) => {
    const auth = e.auth
    if (auth) {
      const role = auth.getString('role')
      if (role === 'consulta') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode criar registros.',
        )
      }
      if (role === 'suporte') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Suporte não possui permissão para criar ou enviar Comunicações.',
        )
      }
    }
    e.next()
  },
  'campanhas',
  'envios',
  'remetentes',
  'email_templates',
  'users',
)

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
  'revendas',
  'contatos',
  'segmentos',
  'inside_sales',
  'responsaveis',
  'canais_faturamento',
  'cargos',
  'estados',
  'status_revenda',
)

onRecordUpdateRequest(
  (e) => {
    const auth = e.auth
    if (auth) {
      const role = auth.getString('role')
      if (role === 'consulta') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode atualizar registros.',
        )
      }
      if (role === 'suporte') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Suporte não possui permissão para alterar Comunicações ou configurações de Administração.',
        )
      }
    }
    e.next()
  },
  'campanhas',
  'envios',
  'remetentes',
  'email_templates',
  'users',
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
  'revendas',
  'contatos',
  'segmentos',
  'inside_sales',
  'responsaveis',
  'canais_faturamento',
  'cargos',
  'estados',
  'status_revenda',
)

onRecordDeleteRequest(
  (e) => {
    const auth = e.auth
    if (auth) {
      const role = auth.getString('role')
      if (role === 'consulta') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Consulta possui permissão exclusiva de leitura e não pode excluir registros.',
        )
      }
      if (role === 'suporte') {
        throw new ForbiddenError(
          'Acesso negado: o perfil Suporte não possui permissão para excluir registros.',
        )
      }
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
