// Migration 0020: Executa teste de autenticação real e todas as requisições HTTP do perfil Consulta
// Salva o resultado em uma tabela temporária ou coleção de auditoria para inspeção direta via db_query

migrate(
  (app) => {
    const results = {
      auth: null,
      writes: {},
      reads: {},
    }

    // Obter URL do PocketBase a partir do ambiente ou usar fallback local
    // No Skip Cloud backend, $os.getenv('VITE_POCKETBASE_URL') ou 'http://127.0.0.1:8090'
    let baseUrl = $os.getenv('VITE_POCKETBASE_URL') || 'http://127.0.0.1:8090'
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    // 1. Autenticar com o usuário consulta via HTTP real
    let token = ''
    let authUser = null
    let authRes = null
    try {
      authRes = $http.send({
        url: baseUrl + '/api/collections/users/auth-with-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: 'rlddbr@780.local',
          password: 'RldDBR@780',
        }),
        timeout: 15,
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
      }
    } catch (authErr) {
      results.auth = { error: '' + authErr }
    }

    // Se a chamada de auth falhou com baseUrl externo, tentar via http://127.0.0.1:8090
    if (!token) {
      try {
        const fallbackUrl = 'http://127.0.0.1:8090'
        authRes = $http.send({
          url: fallbackUrl + '/api/collections/users/auth-with-password',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: 'rlddbr@780.local',
            password: 'RldDBR@780',
          }),
          timeout: 10,
        })
        if (authRes.statusCode === 200 && authRes.json && authRes.json.token) {
          baseUrl = fallbackUrl
          token = authRes.json.token
          authUser = authRes.json.record
          results.auth = {
            status: authRes.statusCode,
            success: true,
            role: authUser.role,
            id: authUser.id,
            note: 'Authenticated via fallback loopback',
          }
        }
      } catch (fbErr) {
        results.authFallbackError = '' + fbErr
      }
    }

    if (!token) {
      // Registrar falha na auditoria
      const audCol = app.findCollectionByNameOrId('auditoria')
      const recAud = new Record(audCol)
      recAud.set('acao', 'TEST_CONSULTA_FAIL')
      recAud.set('registro', 'teste/auth')
      recAud.set('novo_valor', results)
      app.save(recAud)
      return
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: token,
    }

    // (a) Criar um registro em campanhas
    try {
      const resA = $http.send({
        url: baseUrl + '/api/collections/campanhas/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nome: 'Campanha Bloqueio Teste',
          assunto: 'Assunto Teste',
          corpo: '<p>Teste</p>',
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
        status: resA.statusCode,
        blocked: resA.statusCode === 403 || resA.statusCode === 400 || resA.statusCode === 404,
        response: resA.json || resA.raw,
      }
    } catch (eA) {
      results.writes['a_criar_campanha'] = { error: '' + eA }
    }

    // (b) POST /backend/v1/processar-envios
    try {
      const resB = $http.send({
        url: baseUrl + '/backend/v1/processar-envios',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
        timeout: 10,
      })
      results.writes['b_processar_envios'] = {
        status: resB.statusCode,
        blocked: resB.statusCode === 403 || resB.statusCode === 401,
        response: resB.json || resB.raw,
      }
    } catch (eB) {
      results.writes['b_processar_envios'] = { error: '' + eB }
    }

    // IDs para payloads
    let anyCampanhaId = ''
    let anyContatoId = ''
    let anyRevendaId = ''
    let anyEnvioId = ''
    let anySegmentoId = ''
    let anyStatusRevendaId = ''
    try {
      const cRecs = app.findRecordsByFilter('campanhas', '', '-created', 1, 0)
      if (cRecs.length > 0) anyCampanhaId = cRecs[0].id
      const contRecs = app.findRecordsByFilter('contatos', '', '-created', 1, 0)
      if (contRecs.length > 0) anyContatoId = contRecs[0].id
      const rRecs = app.findRecordsByFilter('revendas', '', '-created', 1, 0)
      if (rRecs.length > 0) anyRevendaId = rRecs[0].id
      const envRecs = app.findRecordsByFilter('envios', '', '-created', 1, 0)
      if (envRecs.length > 0) anyEnvioId = envRecs[0].id
      const segs = app.findRecordsByFilter('segmentos', '', '-created', 1, 0)
      if (segs.length > 0) anySegmentoId = segs[0].id
      const stats = app.findRecordsByFilter('status_revenda', '', '-created', 1, 0)
      if (stats.length > 0) anyStatusRevendaId = stats[0].id
    } catch (_) {}

    // (c) Criar/atualizar um envio
    try {
      const resC1 = $http.send({
        url: baseUrl + '/api/collections/envios/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          campanha: anyCampanhaId,
          contato: anyContatoId,
          revenda: anyRevendaId,
          email_utilizado: 'teste@dominio.com',
          status: 'Pendente',
        }),
        timeout: 10,
      })
      results.writes['c_criar_envio'] = {
        status: resC1.statusCode,
        blocked: resC1.statusCode === 403 || resC1.statusCode === 404,
        response: resC1.json || resC1.raw,
      }
    } catch (eC1) {
      results.writes['c_criar_envio'] = { error: '' + eC1 }
    }

    if (anyEnvioId) {
      try {
        const resC2 = $http.send({
          url: baseUrl + '/api/collections/envios/records/' + anyEnvioId,
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: 'Cancelado' }),
          timeout: 10,
        })
        results.writes['c_atualizar_envio'] = {
          status: resC2.statusCode,
          blocked: resC2.statusCode === 403 || resC2.statusCode === 404,
          response: resC2.json || resC2.raw,
        }
      } catch (eC2) {
        results.writes['c_atualizar_envio'] = { error: '' + eC2 }
      }
    }

    // (d) Criar/atualizar revenda e contato
    try {
      const resD1 = $http.send({
        url: baseUrl + '/api/collections/revendas/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nome: 'Tentativa Revenda Consulta',
          segmento: anySegmentoId,
          status: anyStatusRevendaId,
        }),
        timeout: 10,
      })
      results.writes['d_criar_revenda'] = {
        status: resD1.statusCode,
        blocked: resD1.statusCode === 403 || resD1.statusCode === 404,
        response: resD1.json || resD1.raw,
      }
    } catch (eD1) {
      results.writes['d_criar_revenda'] = { error: '' + eD1 }
    }

    if (anyRevendaId) {
      try {
        const resD2 = $http.send({
          url: baseUrl + '/api/collections/revendas/records/' + anyRevendaId,
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ nome: 'Nome Alterado' }),
          timeout: 10,
        })
        results.writes['d_atualizar_revenda'] = {
          status: resD2.statusCode,
          blocked: resD2.statusCode === 403 || resD2.statusCode === 404,
          response: resD2.json || resD2.raw,
        }
      } catch (eD2) {
        results.writes['d_atualizar_revenda'] = { error: '' + eD2 }
      }
    }

    try {
      const resD3 = $http.send({
        url: baseUrl + '/api/collections/contatos/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          revenda: anyRevendaId,
          nome: 'Tentativa Contato Consulta',
          email: 'tentativa@empresa.com',
        }),
        timeout: 10,
      })
      results.writes['d_criar_contato'] = {
        status: resD3.statusCode,
        blocked: resD3.statusCode === 403 || resD3.statusCode === 404,
        response: resD3.json || resD3.raw,
      }
    } catch (eD3) {
      results.writes['d_criar_contato'] = { error: '' + eD3 }
    }

    if (anyContatoId) {
      try {
        const resD4 = $http.send({
          url: baseUrl + '/api/collections/contatos/records/' + anyContatoId,
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ nome: 'Nome Contato Alterado' }),
          timeout: 10,
        })
        results.writes['d_atualizar_contato'] = {
          status: resD4.statusCode,
          blocked: resD4.statusCode === 403 || resD4.statusCode === 404,
          response: resD4.json || resD4.raw,
        }
      } catch (eD4) {
        results.writes['d_atualizar_contato'] = { error: '' + eD4 }
      }
    }

    // (e) Criar/atualizar usuário
    try {
      const resE1 = $http.send({
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
        status: resE1.statusCode,
        blocked: resE1.statusCode === 403 || resE1.statusCode === 404,
        response: resE1.json || resE1.raw,
      }
    } catch (eE1) {
      results.writes['e_criar_usuario'] = { error: '' + eE1 }
    }

    try {
      const resE2 = $http.send({
        url: baseUrl + '/api/collections/users/records/' + authUser.id,
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ role: 'admin', name: 'Tentativa Escalação Role' }),
        timeout: 10,
      })
      results.writes['e_atualizar_usuario'] = {
        status: resE2.statusCode,
        blocked: resE2.statusCode === 403 || resE2.statusCode === 404,
        response: resE2.json || resE2.raw,
      }
    } catch (eE2) {
      results.writes['e_atualizar_usuario'] = { error: '' + eE2 }
    }

    // (f) Escrever em tabelas auxiliares e remetentes
    try {
      const resF1 = $http.send({
        url: baseUrl + '/api/collections/segmentos/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ nome: 'Segmento Invasao Teste' }),
        timeout: 10,
      })
      results.writes['f_criar_segmento'] = {
        status: resF1.statusCode,
        blocked: resF1.statusCode === 403 || resF1.statusCode === 404,
        response: resF1.json || resF1.raw,
      }
    } catch (eF1) {
      results.writes['f_criar_segmento'] = { error: '' + eF1 }
    }

    if (anySegmentoId) {
      try {
        const resF2 = $http.send({
          url: baseUrl + '/api/collections/segmentos/records/' + anySegmentoId,
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ nome: 'Segmento Alterado Teste' }),
          timeout: 10,
        })
        results.writes['f_atualizar_segmento'] = {
          status: resF2.statusCode,
          blocked: resF2.statusCode === 403 || resF2.statusCode === 404,
          response: resF2.json || resF2.raw,
        }
      } catch (eF2) {
        results.writes['f_atualizar_segmento'] = { error: '' + eF2 }
      }
    }

    try {
      const resF3 = $http.send({
        url: baseUrl + '/api/collections/remetentes/records',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          nome: 'Remetente Invasao Teste',
          email: 'invasao_teste@dominio.com.br',
        }),
        timeout: 10,
      })
      results.writes['f_criar_remetente'] = {
        status: resF3.statusCode,
        blocked: resF3.statusCode === 403 || resF3.statusCode === 404,
        response: resF3.json || resF3.raw,
      }
    } catch (eF3) {
      results.writes['f_criar_remetente'] = { error: '' + eF3 }
    }

    // (g) Deletar um envio com status Erro
    let envioErroId = ''
    try {
      const colEnv = app.findCollectionByNameOrId('envios')
      const recErro = new Record(colEnv)
      recErro.set('campanha', anyCampanhaId)
      recErro.set('contato', anyContatoId)
      recErro.set('revenda', anyRevendaId)
      recErro.set('email_utilizado', 'erro_teste_migracao@dominio.com')
      recErro.set('status', 'Erro')
      recErro.set('erro', true)
      recErro.set('mensagem_erro', 'Simulacao para teste de delecao pelo perfil consulta')
      app.save(recErro)
      envioErroId = recErro.id
    } catch (eG1) {
      results.writes['g_preparar_envio_erro'] = { error: '' + eG1 }
    }

    if (envioErroId) {
      try {
        const resG = $http.send({
          url: baseUrl + '/api/collections/envios/records/' + envioErroId,
          method: 'DELETE',
          headers: authHeaders,
          timeout: 10,
        })
        results.writes['g_deletar_envio_erro'] = {
          status: resG.statusCode,
          blocked: resG.statusCode === 403 || resG.statusCode === 404,
          response: resG.json || resG.raw,
        }
      } catch (eG2) {
        results.writes['g_deletar_envio_erro'] = { error: '' + eG2 }
      }

      try {
        const recParaLimpar = app.findRecordById('envios', envioErroId)
        app.delete(recParaLimpar)
      } catch (_) {}
    }

    // 2. Confirmação das Leituras do perfil consulta
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
      } catch (rErr) {
        results.reads[cName] = { error: '' + rErr }
      }
    }

    // Salvar registro de resultado em auditoria
    const audCol = app.findCollectionByNameOrId('auditoria')
    const recAudit = new Record(audCol)
    recAudit.set('acao', 'TEST_CONSULTA_RESULT')
    recAudit.set('registro', 'teste/consulta_full_verification')
    recAudit.set('novo_valor', results)
    app.save(recAudit)
  },
  (app) => {},
)
