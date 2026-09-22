import pb from '@/lib/pocketbase/client'
import type {
  Segmento,
  InsideSales,
  Responsavel,
  CanalFaturamento,
  Cargo,
  Estado,
  StatusRevenda,
  Remetente,
  EmailTemplate,
  Revenda,
  Contato,
  Campanha,
  Envio,
  Auditoria,
  User,
} from '@/types'

// ==================== TABELAS AUXILIARES ====================

export const auxiliaresService = {
  async getSegmentos(): Promise<Segmento[]> {
    return pb.collection('segmentos').getFullList<Segmento>({ sort: 'nome' })
  },
  async getInsideSales(): Promise<InsideSales[]> {
    return pb.collection('inside_sales').getFullList<InsideSales>({ sort: 'nome' })
  },
  async getResponsaveis(): Promise<Responsavel[]> {
    return pb.collection('responsaveis').getFullList<Responsavel>({ sort: 'nome' })
  },
  async getCanaisFaturamento(): Promise<CanalFaturamento[]> {
    return pb.collection('canais_faturamento').getFullList<CanalFaturamento>({ sort: 'nome' })
  },
  async getCargos(): Promise<Cargo[]> {
    return pb.collection('cargos').getFullList<Cargo>({ sort: 'nome' })
  },
  async getEstados(): Promise<Estado[]> {
    return pb.collection('estados').getFullList<Estado>({ sort: 'uf' })
  },
  async getStatusRevenda(): Promise<StatusRevenda[]> {
    return pb.collection('status_revenda').getFullList<StatusRevenda>({ sort: 'nome' })
  },
  async getRemetentes(): Promise<Remetente[]> {
    return pb.collection('remetentes').getFullList<Remetente>({ sort: 'nome' })
  },
  async createRemetente(data: Partial<Remetente>): Promise<Remetente> {
    return pb.collection('remetentes').create<Remetente>(data)
  },
  async updateRemetente(id: string, data: Partial<Remetente>): Promise<Remetente> {
    return pb.collection('remetentes').update<Remetente>(id, data)
  },
  async deleteRemetente(id: string): Promise<boolean> {
    return pb.collection('remetentes').delete(id)
  },
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return pb.collection('email_templates').getFullList<EmailTemplate>({ sort: 'nome' })
  },

  // Métodos auxiliares específicos usados em criação inline
  async createCargo(data: Partial<Cargo>): Promise<Cargo> {
    return pb.collection('cargos').create<Cargo>(data)
  },
  async createSegmento(data: Partial<Segmento>): Promise<Segmento> {
    return pb.collection('segmentos').create<Segmento>(data)
  },
  async createInsideSales(data: Partial<InsideSales>): Promise<InsideSales> {
    return pb.collection('inside_sales').create<InsideSales>(data)
  },
  async createResponsavel(data: Partial<Responsavel>): Promise<Responsavel> {
    return pb.collection('responsaveis').create<Responsavel>(data)
  },
  async createCanalFaturamento(data: Partial<CanalFaturamento>): Promise<CanalFaturamento> {
    return pb.collection('canais_faturamento').create<CanalFaturamento>(data)
  },

  // CRUD genérico para auxiliares
  async createItem(collection: string, data: Record<string, unknown>) {
    return pb.collection(collection).create(data)
  },
  async updateItem(collection: string, id: string, data: Record<string, unknown>) {
    return pb.collection(collection).update(id, data)
  },
  async deleteItem(collection: string, id: string) {
    return pb.collection(collection).delete(id)
  },
}

// ==================== REVENDAS ====================

export const revendasService = {
  async list(
    page = 1,
    perPage = 25,
    filter = '',
    sort = 'nome',
  ): Promise<{ items: Revenda[]; totalItems: number; totalPages: number }> {
    const res = await pb.collection('revendas').getList<Revenda>(page, perPage, {
      filter,
      sort,
      expand: 'segmento,status,inside_sales,responsavel,canal_faturamento,estado',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async getAll(filter = ''): Promise<Revenda[]> {
    return pb.collection('revendas').getFullList<Revenda>({
      filter,
      sort: 'nome',
      expand: 'segmento,status,inside_sales,responsavel,canal_faturamento,estado',
    })
  },

  async getById(id: string): Promise<Revenda> {
    return pb.collection('revendas').getOne<Revenda>(id, {
      expand: 'segmento,status,inside_sales,responsavel,canal_faturamento,estado',
    })
  },

  async create(data: Partial<Revenda>): Promise<Revenda> {
    return pb.collection('revendas').create<Revenda>(data)
  },

  async update(id: string, data: Partial<Revenda>): Promise<Revenda> {
    return pb.collection('revendas').update<Revenda>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('revendas').delete(id)
  },
}

// ==================== CONTATOS ====================

export const contatosService = {
  async list(
    page = 1,
    perPage = 25,
    filter = '',
    sort = 'nome',
  ): Promise<{ items: Contato[]; totalItems: number; totalPages: number }> {
    const res = await pb.collection('contatos').getList<Contato>(page, perPage, {
      filter,
      sort,
      expand: 'revenda,cargo,revenda.segmento,revenda.status',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async getAll(filter = ''): Promise<Contato[]> {
    return pb.collection('contatos').getFullList<Contato>({
      filter,
      sort: 'nome',
      expand: 'revenda,cargo,revenda.segmento,revenda.status',
    })
  },

  async getByRevenda(revendaId: string): Promise<Contato[]> {
    return pb.collection('contatos').getFullList<Contato>({
      filter: `revenda = '${revendaId}'`,
      sort: '-contato_principal,nome',
      expand: 'cargo',
    })
  },

  async create(data: Partial<Contato>): Promise<Contato> {
    return pb.collection('contatos').create<Contato>(data)
  },

  async update(id: string, data: Partial<Contato>): Promise<Contato> {
    return pb.collection('contatos').update<Contato>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('contatos').delete(id)
  },
}

// ==================== CAMPANHAS E ENVIOS ====================

export const comunicacoesService = {
  async createCampanha(data: Partial<Campanha>): Promise<Campanha> {
    return pb.collection('campanhas').create<Campanha>(data)
  },

  async updateCampanha(id: string, data: Partial<Campanha>): Promise<Campanha> {
    return pb.collection('campanhas').update<Campanha>(id, data)
  },

  async listCampanhas(): Promise<Campanha[]> {
    return pb.collection('campanhas').getFullList<Campanha>({
      sort: '-created',
      expand: 'usuario',
    })
  },

  async createEnvio(data: Partial<Envio>): Promise<Envio> {
    return pb.collection('envios').create<Envio>(data)
  },

  async listEnvios(
    page = 1,
    perPage = 25,
    filter = '',
    sort = '-created',
  ): Promise<{ items: Envio[]; totalItems: number; totalPages: number }> {
    const res = await pb.collection('envios').getList<Envio>(page, perPage, {
      filter,
      sort,
      expand: 'campanha,contato,revenda,campanha.usuario',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async getAllEnvios(filter = ''): Promise<Envio[]> {
    return pb.collection('envios').getFullList<Envio>({
      filter,
      sort: '-created',
      expand: 'campanha,contato,revenda,campanha.usuario',
    })
  },

  async triggerProcessarEnvios(
    campanhaId?: string,
    envioId?: string,
  ): Promise<{
    success: boolean
    totalProcessados: number
    totalErros: number
    mode?: 'real' | 'simulado'
    ultimoStatus?: string
    ultimaMensagemErro?: string
  }> {
    try {
      const res = await pb.send('/backend/v1/processar-envios', {
        method: 'POST',
        body: { campanhaId, envioId },
      })
      return res
    } catch (err) {
      console.error('Falha ao acionar processamento imediato de envios:', err)
      return { success: false, totalProcessados: 0, totalErros: 0 }
    }
  },

  async getEnvioById(id: string): Promise<Envio> {
    return pb.collection('envios').getOne<Envio>(id, {
      expand: 'campanha,contato,revenda,campanha.usuario',
    })
  },

  async deleteEnvio(id: string): Promise<boolean> {
    return pb.collection('envios').delete(id)
  },
}

// ==================== AUDITORIA E USUÁRIOS ====================

export const adminService = {
  async listUsers(): Promise<User[]> {
    return pb.collection('users').getFullList<User>({ sort: 'name' })
  },

  async createUser(data: Record<string, unknown>): Promise<User> {
    return pb.collection('users').create<User>(data)
  },

  async updateUser(id: string, data: Record<string, unknown>): Promise<User> {
    return pb.collection('users').update<User>(id, data)
  },

  async setUserPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string; userId: string }> {
    return pb.send<{ success: boolean; message: string; userId: string }>(
      '/backend/v1/admin-users-set-password',
      {
        method: 'POST',
        body: { userId, newPassword },
      },
    )
  },

  async deleteUser(id: string): Promise<boolean> {
    return pb.collection('users').delete(id)
  },

  async listAuditoria(
    page = 1,
    perPage = 25,
    filter = '',
    sort = '-data_hora',
  ): Promise<{ items: Auditoria[]; totalItems: number; totalPages: number }> {
    const res = await pb.collection('auditoria').getList<Auditoria>(page, perPage, {
      filter,
      sort,
      expand: 'usuario',
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async recordManualAudit(
    acao: string,
    registro: string,
    novoValor?: Record<string, unknown>,
    valorAnterior?: Record<string, unknown>,
  ) {
    try {
      await pb.collection('auditoria').create({
        usuario: pb.authStore.record?.id || null,
        acao,
        registro,
        novo_valor: novoValor || null,
        valor_anterior: valorAnterior || null,
      })
    } catch (err) {
      console.warn('Não foi possível gravar auditoria manual:', err)
    }
  },

  async getEmailConfig(): Promise<{
    mode: 'real' | 'simulado'
    configured: boolean
    host: string
    port: string
    user: string
    authMethod?: string
    defaultSender: string
    hasPassword: boolean
    message: string
  }> {
    try {
      const res = await pb.send('/backend/v1/email-config', { method: 'GET' })
      return res
    } catch (_) {
      return {
        mode: 'simulado',
        configured: false,
        host: '',
        port: '',
        user: '',
        defaultSender: 'comunicados@rolanddg.com.br',
        hasPassword: false,
        message: 'Modo Simulado ativo: Nenhum e-mail real sai para a internet.',
      }
    }
  },
}
