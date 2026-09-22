// pocketbase/hooks/test_runner.js
// Endpoint de teste sob demanda para simular e verificar as requisições autenticadas do usuário Consulta
// Chamado via GET /backend/v1/run-consulta-tests
// Utiliza $http.send apontando para a própria API do PocketBase para realizar as operações HTTP exatamente como a aplicação/cliente realiza

routerAdd('GET', '/backend/v1/run-consulta-tests', (e) => {
  const results = {
    auth: null,
    writes: {},
    reads: {},
  }

  // Obter baseUrl a partir da requisição recebida
  const host = e.request.host || '127.0.0.1:8090'
  const isHttps = e.request.tls != null || e.request.header.get('X-Forwarded-Proto') === 'https'
  const protocol = isHttps ? 'https://' : 'http://'
  const baseUrl = protocol + host

  // 1. Autenticar com o usuário consulta
  let token = ''
  let authUser = null
  try {
    const authRes = $http.send({
      url: baseUrl + '/api/collections/users/auth-with-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'rlddbr@780.local',
        password: 'RldDBR@780',
      }),
      timeout: 10,
    })

    results.auth = {
      status: authRes.statusCode,
      success: authRes.statusCode === 200,
      role: authRes.json && authRes.json.record ? authRes.json.record.role : null,
      id: authRes.json && authRes.json.record ? authRes.json.record.id : null,
    }

    if (authRes.statusCode === 200 && authRes.json && authRes.json.token) {
      token = authRes.json.token
      authUser = authRes.json.record
    } else {
      return e.json(500, {
        error: 'Falha ao autenticar usuário consulta',
        details: authRes.raw,
      })
    }
  } catch (authErr) {
    return e.json(500, {
      error: 'Erro de rede/http na autenticação: ' + authErr,
    })
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: token,
  }

  // --- TENTATIVAS DE ESCRITA (a-g) ---

  // (a) Criar um registro em campanhas
  try {
    const resCampanha = $http.send({
      url: baseUrl + '/api/collections/campanhas/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nome: 'Campanha Teste Bloqueio',
        assunto: 'Assunto Teste',
        corpo: '<p>Corpo de teste</p>',
        remetente: 'nao-responda@rolanddg.com.br',
        tipo_envio: 'Teste',
        intervalo_segundos: 10,
        quantidade_destinatarios: 1,
        status: 'Rascunho',
        usuario: authUser.id,
      }),
      timeout: 10,
    })
    results.writes['a_criar_campanha'] = {
      status: resCampanha.statusCode,
      blocked:
        resCampanha.statusCode === 403 ||
        resCampanha.statusCode === 400 ||
        resCampanha.statusCode === 404,
      response: resCampanha.json || resCampanha.raw,
    }
  } catch (errA) {
    results.writes['a_criar_campanha'] = { error: '' + errA }
  }

  // (b) POST /backend/v1/processar-envios
  try {
    const resProcessar = $http.send({
      url: baseUrl + '/backend/v1/processar-envios',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
      timeout: 10,
    })
    results.writes['b_processar_envios'] = {
      status: resProcessar.statusCode,
      blocked: resProcessar.statusCode === 403 || resProcessar.statusCode === 401,
      response: resProcessar.json || resProcessar.raw,
    }
  } catch (errB) {
    results.writes['b_processar_envios'] = { error: '' + errB }
  }

  // (c) Criar e Atualizar um envio
  // Buscar IDs existentes para payload
  let anyCampanhaId = ''
  let anyContatoId = ''
  let anyRevendaId = ''
  let anyEnvioId = ''
  try {
    const cRecs = $app.findRecordsByFilter('campanhas', '', '-created', 1, 0)
    if (cRecs.length > 0) anyCampanhaId = cRecs[0].id
    const contRecs = $app.findRecordsByFilter('contatos', '', '-created', 1, 0)
    if (contRecs.length > 0) anyContatoId = contRecs[0].id
    const rRecs = $app.findRecordsByFilter('revendas', '', '-created', 1, 0)
    if (rRecs.length > 0) anyRevendaId = rRecs[0].id
    const envRecs = $app.findRecordsByFilter('envios', '', '-created', 1, 0)
    if (envRecs.length > 0) anyEnvioId = envRecs[0].id
  } catch (_) {}

  // Criar envio
  try {
    const resCriarEnvio = $http.send({
      url: baseUrl + '/api/collections/envios/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        campanha: anyCampanhaId,
        contato: anyContatoId,
        revenda: anyRevendaId,
        email_utilizado: 'teste_bloqueio@dominio.com',
        status: 'Pendente',
      }),
      timeout: 10,
    })
    results.writes['c_criar_envio'] = {
      status: resCriarEnvio.statusCode,
      blocked: resCriarEnvio.statusCode === 403 || resCriarEnvio.statusCode === 404,
      response: resCriarEnvio.json || resCriarEnvio.raw,
    }
  } catch (errC1) {
    results.writes['c_criar_envio'] = { error: '' + errC1 }
  }

  // Atualizar envio existente
  if (anyEnvioId) {
    try {
      const resAtualizarEnvio = $http.send({
        url: baseUrl + '/api/collections/envios/records/' + anyEnvioId,
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'Cancelado',
        }),
        timeout: 10,
      })
      results.writes['c_atualizar_envio'] = {
        status: resAtualizarEnvio.statusCode,
        blocked: resAtualizarEnvio.statusCode === 403 || resAtualizarEnvio.statusCode === 404,
        response: resAtualizarEnvio.json || resAtualizarEnvio.raw,
      }
    } catch (errC2) {
      results.writes['c_atualizar_envio'] = { error: '' + errC2 }
    }
  }

  // (d) Criar e Atualizar uma revenda e um contato
  // Criar revenda
  let anySegmentoId = ''
  let anyStatusRevendaId = ''
  try {
    const segs = $app.findRecordsByFilter('segmentos', '', '-created', 1, 0)
    if (segs.length > 0) anySegmentoId = segs[0].id
    const stats = $app.findRecordsByFilter('status_revenda', '', '-created', 1, 0)
    if (stats.length > 0) anyStatusRevendaId = stats[0].id
  } catch (_) {}

  try {
    const resCriarRevenda = $http.send({
      url: baseUrl + '/api/collections/revendas/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nome: 'Revenda Tentativa Bloqueio',
        segmento: anySegmentoId,
        status: anyStatusRevendaId,
      }),
      timeout: 10,
    })
    results.writes['d_criar_revenda'] = {
      status: resCriarRevenda.statusCode,
      blocked: resCriarRevenda.statusCode === 403 || resCriarRevenda.statusCode === 404,
      response: resCriarRevenda.json || resCriarRevenda.raw,
    }
  } catch (errD1) {
    results.writes['d_criar_revenda'] = { error: '' + errD1 }
  }

  // Atualizar revenda
  if (anyRevendaId) {
    try {
      const resAtualizarRevenda = $http.send({
        url: baseUrl + '/api/collections/revendas/records/' + anyRevendaId,
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          nome: 'Nome Modificado Pelo Consulta',
        }),
        timeout: 10,
      })
      results.writes['d_atualizar_revenda'] = {
        status: resAtualizarRevenda.statusCode,
        blocked: resAtualizarRevenda.statusCode === 403 || resAtualizarRevenda.statusCode === 404,
        response: resAtualizarRevenda.json || resAtualizarRevenda.raw,
      }
    } catch (errD2) {
      results.writes['d_atualizar_revenda'] = { error: '' + errD2 }
    }
  }

  // Criar contato
  try {
    const resCriarContato = $http.send({
      url: baseUrl + '/api/collections/contatos/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        revenda: anyRevendaId,
        nome: 'Contato Tentativa Bloqueio',
        email: 'bloqueio@empresa.com.br',
      }),
      timeout: 10,
    })
    results.writes['d_criar_contato'] = {
      status: resCriarContato.statusCode,
      blocked: resCriarContato.statusCode === 403 || resCriarContato.statusCode === 404,
      response: resCriarContato.json || resCriarContato.raw,
    }
  } catch (errD3) {
    results.writes['d_criar_contato'] = { error: '' + errD3 }
  }

  // Atualizar contato
  if (anyContatoId) {
    try {
      const resAtualizarContato = $http.send({
        url: baseUrl + '/api/collections/contatos/records/' + anyContatoId,
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          nome: 'Nome Contato Alterado',
        }),
        timeout: 10,
      })
      results.writes['d_atualizar_contato'] = {
        status: resAtualizarContato.statusCode,
        blocked: resAtualizarContato.statusCode === 403 || resAtualizarContato.statusCode === 404,
        response: resAtualizarContato.json || resAtualizarContato.raw,
      }
    } catch (errD4) {
      results.writes['d_atualizar_contato'] = { error: '' + errD4 }
    }
  }

  // (e) Criar e Atualizar um usuário
  // Criar usuário
  try {
    const resCriarUser = $http.send({
      url: baseUrl + '/api/collections/users/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: 'novo_bloqueado@780.local',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        role: 'consulta',
        name: 'Tentativa Usuario',
      }),
      timeout: 10,
    })
    results.writes['e_criar_usuario'] = {
      status: resCriarUser.statusCode,
      blocked: resCriarUser.statusCode === 403 || resCriarUser.statusCode === 404,
      response: resCriarUser.json || resCriarUser.raw,
    }
  } catch (errE1) {
    results.writes['e_criar_usuario'] = { error: '' + errE1 }
  }

  // Atualizar usuário (tentar alterar o próprio perfil para admin)
  try {
    const resAtualizarUser = $http.send({
      url: baseUrl + '/api/collections/users/records/' + authUser.id,
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        role: 'admin',
        name: 'Hackeado Admin',
      }),
      timeout: 10,
    })
    results.writes['e_atualizar_usuario'] = {
      status: resAtualizarUser.statusCode,
      blocked: resAtualizarUser.statusCode === 403 || resAtualizarUser.statusCode === 404,
      response: resAtualizarUser.json || resAtualizarUser.raw,
    }
  } catch (errE2) {
    results.writes['e_atualizar_usuario'] = { error: '' + errE2 }
  }

  // (f) Escrever em tabelas auxiliares e remetentes
  // Criar segmento
  try {
    const resCriarSeg = $http.send({
      url: baseUrl + '/api/collections/segmentos/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ nome: 'Segmento Invasao' }),
      timeout: 10,
    })
    results.writes['f_criar_segmento'] = {
      status: resCriarSeg.statusCode,
      blocked: resCriarSeg.statusCode === 403 || resCriarSeg.statusCode === 404,
      response: resCriarSeg.json || resCriarSeg.raw,
    }
  } catch (errF1) {
    results.writes['f_criar_segmento'] = { error: '' + errF1 }
  }

  // Atualizar segmento
  if (anySegmentoId) {
    try {
      const resAtualizarSeg = $http.send({
        url: baseUrl + '/api/collections/segmentos/records/' + anySegmentoId,
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ nome: 'Segmento Alterado' }),
        timeout: 10,
      })
      results.writes['f_atualizar_segmento'] = {
        status: resAtualizarSeg.statusCode,
        blocked: resAtualizarSeg.statusCode === 403 || resAtualizarSeg.statusCode === 404,
        response: resAtualizarSeg.json || resAtualizarSeg.raw,
      }
    } catch (errF2) {
      results.writes['f_atualizar_segmento'] = { error: '' + errF2 }
    }
  }

  // Criar remetente
  try {
    const resCriarRem = $http.send({
      url: baseUrl + '/api/collections/remetentes/records',
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nome: 'Remetente Invasao',
        email: 'invasao@dominio.com.br',
      }),
      timeout: 10,
    })
    results.writes['f_criar_remetente'] = {
      status: resCriarRem.statusCode,
      blocked: resCriarRem.statusCode === 403 || resCriarRem.statusCode === 404,
      response: resCriarRem.json || resCriarRem.raw,
    }
  } catch (errF3) {
    results.writes['f_criar_remetente'] = { error: '' + errF3 }
  }

  // (g) Deletar um envio com status Erro
  // Criar temporariamente um envio com status 'Erro' no DB via $app (nível de sistema) para testar a tentativa de deleção pela API HTTP do consulta
  let envioErroId = ''
  try {
    const colEnvios = $app.findCollectionByNameOrId('envios')
    const recErro = new Record(colEnvios)
    recErro.set('campanha', anyCampanhaId)
    recErro.set('contato', anyContatoId)
    recErro.set('revenda', anyRevendaId)
    recErro.set('email_utilizado', 'erro_teste@dominio.com')
    recErro.set('status', 'Erro')
    recErro.set('erro', true)
    recErro.set('mensagem_erro', 'Simulacao para teste de delecao pelo perfil consulta')
    $app.save(recErro)
    envioErroId = recErro.id
  } catch (errGCreate) {
    results.writes['g_preparar_envio_erro'] = { error: '' + errGCreate }
  }

  if (envioErroId) {
    try {
      const resDeleteEnvio = $http.send({
        url: baseUrl + '/api/collections/envios/records/' + envioErroId,
        method: 'DELETE',
        headers: authHeaders,
        timeout: 10,
      })
      results.writes['g_deletar_envio_erro'] = {
        status: resDeleteEnvio.statusCode,
        blocked: resDeleteEnvio.statusCode === 403 || resDeleteEnvio.statusCode === 404,
        response: resDeleteEnvio.json || resDeleteEnvio.raw,
      }
    } catch (errGDel) {
      results.writes['g_deletar_envio_erro'] = { error: '' + errGDel }
    }

    // Limpar o registro de teste do DB via $app para manter o estado limpo
    try {
      const recParaLimpar = $app.findRecordById('envios', envioErroId)
      $app.delete(recParaLimpar)
    } catch (_) {}
  }

  // --- CONFIRMAÇÃO DE LEITURAS (item 2) ---
  const collectionsToRead = [
    'revendas',
    'contatos',
    'campanhas',
    'envios',
    'auditoria',
    'segmentos',
    'inside_sales',
    'responsaveis',
    'canais_faturamento',
    'cargos',
    'estados',
    'status_revenda',
    'remetentes',
    'email_templates',
    'users',
  ]

  for (const cName of collectionsToRead) {
    try {
      const readRes = $http.send({
        url: baseUrl + '/api/collections/' + cName + '/records?page=1&perPage=2',
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      results.reads[cName] = {
        status: readRes.statusCode,
        ok: readRes.statusCode === 200,
        totalItems:
          readRes.json && readRes.json.totalItems !== undefined ? readRes.json.totalItems : null,
      }
    } catch (readErr) {
      results.reads[cName] = { error: '' + readErr }
    }
  }

  return e.json(200, results)
})
