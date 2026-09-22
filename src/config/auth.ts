/**
 * Configuração centralizada para autenticação do sistema.
 *
 * Contém as credenciais públicas para o acesso de visualização / somente leitura (role: consulta).
 * Esse acesso permite que a equipe interna (Inside Sales, suporte, etc.) acesse a plataforma
 * com um único clique na tela de login, sem necessidade de digitar senha para tarefas do dia a dia.
 *
 * Alterações cadastrais, envios de e-mails, exclusões e configurações administrativas
 * continuam restritas a usuários autenticados com credenciais completas de Admin ou Gestor,
 * conforme protegido no frontend e estritamente validado por API rules e hooks de backend.
 */

export const CONSULTA_AUTH_CONFIG = {
  email: 'rlddbr@780.local',
  password: 'RldDBR@780',
  displayName: 'RldDBR@780',
  role: 'consulta' as const,
  label: 'Entrar apenas para visualização',
  description: 'Acesso rápido para visualização sem necessidade de digitar senha',
} as const
