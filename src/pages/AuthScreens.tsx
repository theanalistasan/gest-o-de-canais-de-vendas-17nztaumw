import React, { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'

export const LoginScreen: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.')
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').authWithPassword(email.trim(), password)
      navigate('/dashboard')
    } catch (err: unknown) {
      console.error('Falha no login:', err)
      setErrorMsg('Credenciais inválidas. Verifique seu e-mail e senha.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-slate-900 to-blue-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-bold text-2xl">
            GC
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Gestão de Canais de Vendas
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Acesse a plataforma corporativa de revendas e comunicações
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <p className="font-medium">{errorMsg}</p>
                <p className="text-xs text-red-600/80 mt-1">
                  Verifique se o e-mail está escrito corretamente e se a senha respeita
                  maiúsculas/minúsculas.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@rolanddg.com.br"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-md shadow-blue-500/20 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export const ForgotPasswordScreen: React.FC = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setIsLoading(true)

    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setIsSuccess(true)
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Recuperar Senha</h2>
          <p className="text-sm text-slate-500 mb-6">
            Insira seu e-mail cadastrado para receber o link de redefinição de senha.
          </p>

          {isSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm space-y-3">
              <p className="font-semibold">Solicitação enviada com sucesso!</p>
              <p>
                Verifique sua caixa de entrada e siga as instruções para definir sua nova senha.
              </p>
              <Link
                to="/login"
                className="inline-block text-sm font-semibold text-blue-600 hover:underline"
              >
                Voltar ao Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail Cadastrado
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu.email@empresa.com.br"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </button>
              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-slate-500 hover:text-slate-800">
                  Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export const ResetPasswordScreen: React.FC = () => {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const token = new URLSearchParams(window.location.search).get('token') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setErrorMsg('As senhas digitadas não coincidem.')
      return
    }
    if (password.length < 8) {
      setErrorMsg('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setIsSuccess(true)
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('Token inválido ou expirado. Solicite uma nova redefinição.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Definir Nova Senha</h2>
          {isSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm space-y-3">
              <p className="font-semibold">Senha alterada com sucesso!</p>
              <Link
                to="/login"
                className="inline-block text-sm font-semibold text-blue-600 hover:underline"
              >
                Fazer login agora
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nova Senha (min. 8 dígitos)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export const VerifyEmailScreen: React.FC = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const token = new URLSearchParams(window.location.search).get('token') || ''

  React.useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    pb.collection('users')
      .confirmVerification(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Verificação de Conta</h2>
          {status === 'verifying' && (
            <div className="flex items-center justify-center gap-2 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>Confirmando seu e-mail...</span>
            </div>
          )}
          {status === 'success' && (
            <div className="space-y-3">
              <p className="text-emerald-700 font-semibold">Conta verificada com sucesso!</p>
              <Link
                to="/login"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
                Ir para o Login
              </Link>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-red-700">Token de verificação inválido ou expirado.</p>
              <Link to="/login" className="text-sm text-blue-600 underline">
                Voltar ao Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const ConfirmEmailChangeScreen: React.FC = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const { logout } = useAuth()

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      logout()
      setStatus('success')
    } catch (err) {
      console.error(err)
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Confirmar Novo E-mail</h2>
          {status === 'success' ? (
            <div className="space-y-3">
              <p className="text-emerald-700 font-semibold text-sm">
                E-mail alterado com sucesso! Faça login novamente.
              </p>
              <Link
                to="/login"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
              >
                Entrar
              </Link>
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <p className="text-xs text-slate-500">
                Digite sua senha atual para autorizar a alteração de endereço.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Confirmando...' : 'Confirmar Alteração'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
