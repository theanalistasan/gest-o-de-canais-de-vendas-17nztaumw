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
 * Texto fixo de confidencialidade (PT e EN) exigido no rodapé de toda comunicação enviada
 */
export const CONFIDENCIALIDADE_PT =
  'Esta mensagem (incluindo eventuais anexos) destina-se exclusivamente ao uso de pessoas e entidades autorizadas pela Roland DG Brasil, estando protegida pelo sigilo profissional e pela legislação aplicável. Caso você tenha recebido este e-mail por engano, por favor, notifique o remetente e exclua esta mensagem imediatamente. O uso não autorizado dessas informações é proibido e está sujeito às penalidades aplicáveis.'

export const CONFIDENCIALIDADE_EN =
  'This message (including attachments, if any) is for the exclusive use of persons and entities authorized by Roland DG Brazil, protected by professional secrecy and by law. If you have received this e-mail in error, please notify the sender and delete this message immediately. Unauthorized use of such information is prohibited and subject to applicable penalties.'

/**
 * Constrói o HTML completo compatível com clientes de e-mail (Outlook, Gmail, Apple Mail, Webmail)
 * contendo cabeçalho com logo Roland DG Brasil, corpo da mensagem, fechamento/assinatura oficial
 * e o rodapé fixo de confidencialidade obrigatório (9-10px, cinza discreto).
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
            <td style="padding: 16px 32px; background-color: #ffffff; text-align: left; border-bottom: 2px solid #005696;">
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
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td style="font-size: 13px; line-height: 1.6; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    ${safeFechamento}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Fixo de Confidencialidade (PT / EN) -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <tr>
                  <td style="font-size: 9.5px; line-height: 1.5; color: #6b7280; text-align: justify; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="margin: 0 0 8px 0;">
                      ${CONFIDENCIALIDADE_PT}
                    </p>
                    <p style="margin: 0;">
                      ${CONFIDENCIALIDADE_EN}
                    </p>
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
export interface ExecuteWithRetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  factor?: number
  maxDelayMs?: number
  signal?: AbortSignal
  onRetry?: (attempt: number, error: unknown, delayMs: number, is429: boolean) => void
}

/**
 * Extrai o valor do cabeçalho Retry-After em milissegundos se presente no erro/resposta HTTP
 */
function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const errObj = err as Record<string, unknown>
  const response = (errObj.response || errObj) as Record<string, unknown> | undefined
  const headers = response?.headers as Record<string, unknown> | Headers | undefined

  let retryAfterHeader: string | null = null
  if (headers) {
    if (typeof (headers as Headers).get === 'function') {
      retryAfterHeader =
        (headers as Headers).get('retry-after') || (headers as Headers).get('Retry-After')
    } else if (typeof headers === 'object') {
      const hObj = headers as Record<string, unknown>
      retryAfterHeader = (hObj['retry-after'] || hObj['Retry-After']) as string | null
    }
  }

  if (!retryAfterHeader && typeof errObj.retryAfter === 'number') {
    return Math.max(500, Math.round(errObj.retryAfter * 1000))
  }

  if (retryAfterHeader) {
    const parsedSec = parseFloat(retryAfterHeader)
    if (!Number.isNaN(parsedSec) && parsedSec > 0) {
      return Math.max(500, Math.round(parsedSec * 1000))
    }
    const parsedDate = Date.parse(retryAfterHeader)
    if (!Number.isNaN(parsedDate)) {
      const diffMs = parsedDate - Date.now()
      if (diffMs > 0) return diffMs
    }
  }

  return null
}

/**
 * Identifica se o erro é explicitamente um status 429 Too Many Requests
 */
export function is429Error(err: unknown): boolean {
  if (!err) return false
  const errObj = err as Record<string, unknown>
  if (
    errObj.status === 429 ||
    (errObj.response && (errObj.response as Record<string, unknown>).status === 429)
  ) {
    return true
  }
  const errStr = String(err).toLowerCase()
  return (
    errStr.includes('429') || errStr.includes('too many requests') || errStr.includes('rate limit')
  )
}

/**
 * Função utilitária com backoff adaptativo e jitter para operações resilientes contra concorrência SQLite/429
 * Respeita Retry-After quando presente, backoff progressivo de 429 (1s -> 2s -> 4s -> 8s cap 30s) e AbortSignal.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: ExecuteWithRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 5
  const initialDelay = options.initialDelayMs ?? 400
  const factor = options.factor ?? 2
  const maxDelayMs = options.maxDelayMs ?? 30000
  const signal = options.signal

  let lastError: unknown
  let currentDelay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário', 'AbortError')
    }

    try {
      return await operation(attempt)
    } catch (err: unknown) {
      lastError = err

      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário', 'AbortError')
      }

      // Se for a última tentativa, propaga o erro
      if (attempt === maxAttempts) {
        break
      }

      const isRateLimit = is429Error(err)
      const errStr = String(err).toLowerCase()

      // Se for erro de validação terminal (ex: 400 Bad Request por campo faltante, 403 Forbidden estrito, 404), não repete
      const isTerminalAuthOrValidation =
        (errStr.includes('403') ||
          errStr.includes('forbidden') ||
          errStr.includes('permissão') ||
          errStr.includes('validation_') ||
          (errStr.includes('400') && !errStr.includes('locked'))) &&
        !isRateLimit

      if (isTerminalAuthOrValidation) {
        throw err
      }

      // Calcula tempo de espera adaptativo
      let waitTime: number
      const retryAfterMs = extractRetryAfterMs(err)

      if (retryAfterMs !== null) {
        waitTime = Math.min(retryAfterMs, maxDelayMs)
      } else if (isRateLimit) {
        // Backoff progressivo específico para 429: 1s -> 2s -> 4s -> 8s -> 16s (cap ~30s)
        const base429 = Math.min(1000 * Math.pow(2, attempt - 1), maxDelayMs)
        const jitter = (Math.random() - 0.5) * 0.3 * base429
        waitTime = Math.max(800, Math.round(base429 + jitter))
      } else {
        // Outros erros transientes (lock, network)
        const jitter = (Math.random() - 0.5) * 0.4 * currentDelay
        waitTime = Math.max(200, Math.min(Math.round(currentDelay + jitter), maxDelayMs))
        currentDelay = Math.min(Math.round(currentDelay * factor), maxDelayMs)
      }

      if (options.onRetry) {
        options.onRetry(attempt, err, waitTime, isRateLimit)
      }

      // Espera respeitando o AbortSignal
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const onAbort = () => {
          if (timer) clearTimeout(timer)
          reject(new DOMException('Operação cancelada pelo usuário', 'AbortError'))
        }

        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true })
        }

        timer = setTimeout(() => {
          if (signal) {
            signal.removeEventListener('abort', onAbort)
          }
          resolve()
        }, waitTime)
      })
    }
  }

  throw lastError
}
