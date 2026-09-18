import pb from '@/lib/pocketbase/client'

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  from: string
  campanhaId?: string
  contatoId?: string
  revendaId?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Interface do serviço de e-mail da aplicação.
 * Abstração desenhada para permitir que uma integração real com Microsoft Graph / Exchange Online
 * seja plugada posteriormente sem alterar as regras de negócio da aplicação.
 *
 * TODO: Para ativar o Microsoft Graph / Exchange Online:
 * 1. Instalar @microsoft/microsoft-graph-client
 * 2. Obter token OAuth2 via client_credentials (Azure App Registration com permissão Mail.Send)
 * 3. Chamar graphClient.api('/users/{from}/sendMail').post(...) no método sendIndividual.
 */
export interface IEmailService {
  sendIndividual(payload: SendEmailPayload): Promise<SendEmailResult>
}

class SimulatedEmailService implements IEmailService {
  /**
   * Implementação inicial: modo simulado / registro auditável.
   * Cria ou atualiza o registro correspondente na collection `envios`, garantindo auditoria e conformidade.
   */
  async sendIndividual(payload: SendEmailPayload): Promise<SendEmailResult> {
    const { to, subject, body, from, campanhaId, contatoId, revendaId } = payload

    // Validação básica do destinatário
    const isValidEmail = to && to.includes('@') && to.includes('.')
    if (!isValidEmail) {
      return {
        success: false,
        error: `E-mail de destino inválido ou ausente: "${to}"`,
      }
    }

    try {
      // Se tiver parâmetros para registrar na collection envios
      if (campanhaId && contatoId && revendaId) {
        await pb.collection('envios').create({
          campanha: campanhaId,
          contato: contatoId,
          revenda: revendaId,
          email_utilizado: to,
          status: 'Enviado',
          data_envio: new Date().toISOString(),
          sucesso: true,
          erro: false,
          mensagem_erro: 'Simulado — nenhum e-mail enviado de fato',
        })
      }

      console.info(
        `[EmailService:Simulado] Mensagem enviada com sucesso para ${to} a partir de ${from}. Assunto: ${subject}. Tamanho do corpo: ${body.length} caracteres.`,
      )

      return {
        success: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: msg,
      }
    }
  }
}

export const EmailService: IEmailService = new SimulatedEmailService()
