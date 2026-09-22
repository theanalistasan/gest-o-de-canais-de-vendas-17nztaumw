import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  role: UserRole
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  isGestor: boolean
  isConsulta: boolean
  isSuporte: boolean
  canWrite: boolean
  canCadastros: boolean
  canComunicacoes: boolean
  canDelete: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      return pb.authStore.record as unknown as User
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    // Escutar mudanças no authStore do PocketBase
    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser((model as unknown as User) || null)
    })

    // Validar token ao montar
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser(res.record as unknown as User)
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      try {
        const res = await pb.collection('users').authRefresh()
        setUser(res.record as unknown as User)
      } catch (err) {
        console.error('Falha ao atualizar dados de usuário:', err)
      }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const role: UserRole = user?.role || 'consulta'
  const isAdmin = role === 'admin'
  const isGestor = role === 'gestor'
  const isConsulta = role === 'consulta'
  const isSuporte = role === 'suporte'
  // canWrite padrão: permissão geral para cadastros (admin, gestor, suporte)
  const canCadastros = isAdmin || isGestor || isSuporte
  // canWrite mantido para retrocompatibilidade onde usado em cadastros
  const canWrite = canCadastros
  // comunicações: suporte e consulta NÃO podem disparar ou criar campanhas
  const canComunicacoes = isAdmin || isGestor
  // exclusão: suporte e consulta NÃO podem excluir nada
  const canDelete = isAdmin || isGestor

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated: !!user && pb.authStore.isValid,
      isLoading,
      isAdmin,
      isGestor,
      isConsulta,
      isSuporte,
      canWrite,
      canCadastros,
      canComunicacoes,
      canDelete,
      logout,
      refreshUser,
    }),
    [
      user,
      role,
      isLoading,
      isAdmin,
      isGestor,
      isConsulta,
      isSuporte,
      canWrite,
      canCadastros,
      canComunicacoes,
      canDelete,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
