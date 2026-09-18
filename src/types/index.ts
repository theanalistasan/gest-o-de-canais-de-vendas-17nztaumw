export type UserRole = 'admin' | 'gestor' | 'consulta'

export interface User {
  id: string
  email: string
  name: string
  role?: UserRole
  avatar?: string
  created: string
  updated: string
}

export interface Segmento {
  id: string
  nome: string
  created?: string
  updated?: string
}

export interface InsideSales {
  id: string
  nome: string
  created?: string
  updated?: string
}

export interface Responsavel {
  id: string
  nome: string
  created?: string
  updated?: string
}

export interface CanalFaturamento {
  id: string
  nome: string
  created?: string
  updated?: string
}

export interface Cargo {
  id: string
  nome: string
  created?: string
  updated?: string
}

export interface Estado {
  id: string
  nome: string
  uf: string
  created?: string
  updated?: string
}

export interface StatusRevenda {
  id: string
  nome: string
  cor?: string
  created?: string
  updated?: string
}

export interface Remetente {
  id: string
  nome: string
  email: string
  created?: string
  updated?: string
}

export interface EmailTemplate {
  id: string
  nome: string
  assunto: string
  corpo: string
  created?: string
  updated?: string
}

export interface Revenda {
  id: string
  codigo?: string
  nome: string
  segmento: string
  status: string
  inside_sales?: string
  responsavel?: string
  canal_faturamento?: string
  estado?: string
  cidade?: string
  observacoes?: string
  created: string
  updated: string
  // Expansões comuns
  expand?: {
    segmento?: Segmento
    status?: StatusRevenda
    inside_sales?: InsideSales
    responsavel?: Responsavel
    canal_faturamento?: CanalFaturamento
    estado?: Estado
    contatos_via_revenda?: Contato[]
  }
}

export interface Contato {
  id: string
  revenda: string
  nome: string
  cargo?: string
  email?: string
  email_secundario?: string
  telefone?: string
  celular?: string
  whatsapp?: string
  estado_regiao?: string
  contato_principal?: boolean
  recebe_comunicacoes?: boolean
  observacoes?: string
  status_contato?: 'Ativo' | 'Inativo'
  created: string
  updated: string
  expand?: {
    revenda?: Revenda
    cargo?: Cargo
  }
}

export interface Campanha {
  id: string
  nome: string
  assunto: string
  corpo: string
  remetente: string
  tipo_envio: 'Teste' | 'Producao'
  intervalo_segundos: number
  quantidade_destinatarios: number
  status: 'Rascunho' | 'Agendada' | 'Enviando' | 'Concluida' | 'Cancelada' | 'Erro'
  usuario: string
  created: string
  updated: string
  expand?: {
    usuario?: User
  }
}

export interface Envio {
  id: string
  campanha: string
  contato: string
  revenda: string
  email_utilizado?: string
  status: 'Pendente' | 'Enviado' | 'Erro' | 'Cancelado'
  data_envio?: string
  sucesso?: boolean
  erro?: boolean
  mensagem_erro?: string
  created: string
  updated: string
  expand?: {
    campanha?: Campanha
    contato?: Contato
    revenda?: Revenda
  }
}

export interface Auditoria {
  id: string
  usuario?: string
  acao: string
  data_hora: string
  registro: string
  valor_anterior?: Record<string, unknown> | null
  novo_valor?: Record<string, unknown> | null
  created: string
  updated: string
  expand?: {
    usuario?: User
  }
}
