import pb from '@/lib/pocketbase/client'

/**
 * URL absoluta da API do PocketBase para montagem de assets remotos
 */
export const POCKETBASE_BASE_URL = (
  (import.meta as unknown as { env?: { VITE_POCKETBASE_URL?: string } }).env?.VITE_POCKETBASE_URL ||
  pb.baseUrl ||
  ''
).replace(/\/$/, '')

/**
 * URL absoluta oficial do logo Roland DG Brasil
 */
export const ROLAND_LOGO_URL = `${POCKETBASE_BASE_URL}/backend/v1/roland-logo.png`

/**
 * Texto padrão do Fechamento / Assinatura do E-mail (exato solicitado pelo usuário)
 */
export const DEFAULT_EMAIL_FECHAMENTO = `Departamento Comercial

Roland DG Brasil Imp e Exp Ltda
Rua San Jose, nº 780 - Pq Industrial San Jose
CEP 06715-862 - (11) 3500-2600 Opção 1`

/**
 * Constrói o HTML completo compatível com clientes de e-mail (Outlook, Gmail, Apple Mail, Webmail)
 * contendo cabeçalho com logo Roland DG Brasil, corpo da mensagem e fechamento/assinatura oficial.
 */
export function buildRolandEmailHtml(
  corpoTextoOuHtml: string,
  fechamentoTexto: string = DEFAULT_EMAIL_FECHAMENTO,
): string {
  // Converte quebras de linha normais para <br/> se não tiver tags HTML de bloco
  const hasBlockTags = /<(p|div|table|h[1-6]|ul|ol|li)[^>]*>/i.test(corpoTextoOuHtml)
  const safeCorpo = hasBlockTags ? corpoTextoOuHtml : corpoTextoOuHtml.replace(/\n/g, '<br/>')

  const safeFechamento = (fechamentoTexto || DEFAULT_EMAIL_FECHAMENTO).replace(/\n/g, '<br/>')

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Roland DG Brasil</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Cabeçalho Oficial Roland DG Brasil -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; background-color: #ffffff; text-align: left; border-bottom: 2px solid #005696;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <img src="${ROLAND_LOGO_URL}" alt="Roland DG Brasil" width="340" style="display: block; width: 340px; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #005696;" />
                  </td>
                  <td align="right" valign="middle" style="font-size: 11px; color: #64748b; font-family: Arial, sans-serif; font-weight: 500;">
                    Comunicação Oficial
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo Principal do E-mail -->
          <tr>
            <td style="padding: 32px; font-size: 14px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              ${safeCorpo}
            </td>
          </tr>

          <!-- Fechamento / Assinatura Oficial Roland DG -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td style="font-size: 13px; line-height: 1.6; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    ${safeFechamento}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td style="padding: 16px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; font-family: Arial, sans-serif;">
              Roland DG Brasil &bull; Todos os direitos reservados.<br />
              Esta é uma mensagem automática enviada através do canal autorizado.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Função utilitária com backoff exponencial e jitter para operações resilientes contra concorrência SQLite/429
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelayMs?: number
    factor?: number
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4
  const initialDelay = options.initialDelayMs ?? 350
  const factor = options.factor ?? 1.8

  let lastError: unknown
  let currentDelay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt)
    } catch (err: unknown) {
      lastError = err

      // Se for a última tentativa, propaga o erro
      if (attempt === maxAttempts) {
        break
      }

      // Detecta se é erro transiente ou 429/lock/network
      const errStr = String(err).toLowerCase()
      const isTransient =
        errStr.includes('429') ||
        errStr.includes('too many') ||
        errStr.includes('busy') ||
        errStr.includes('locked') ||
        errStr.includes('database is locked') ||
        errStr.includes('timeout') ||
        errStr.includes('network') ||
        errStr.includes('failed to fetch') ||
        errStr.includes('connection') ||
        errStr.includes('cannot connect') ||
        errStr.includes('autocancelled')

      // Se for erro de validação terminal (ex: 400 Bad Request por campo faltante, 403 Forbidden estrito), não repete
      const isTerminalAuthOrValidation =
        (errStr.includes('403') || errStr.includes('forbidden') || errStr.includes('permissão')) &&
        !errStr.includes('locked')

      if (isTerminalAuthOrValidation) {
        throw err
      }

      // Jitter aleatório +/- 20%
      const jitter = (Math.random() - 0.5) * 0.4 * currentDelay
      const waitTime = Math.max(100, Math.round(currentDelay + jitter))

      if (options.onRetry) {
        options.onRetry(attempt, err, waitTime)
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime))
      currentDelay = Math.round(currentDelay * factor)
    }
  }

  throw lastError
}
