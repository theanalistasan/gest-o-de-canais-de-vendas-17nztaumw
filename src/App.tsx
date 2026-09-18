import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import Layout from '@/components/Layout'
import NotFound from '@/pages/NotFound'
import { DashboardScreen } from '@/pages/DashboardScreen'
import { RevendasScreen } from '@/pages/RevendasScreen'
import { RevendaDetailScreen } from '@/pages/RevendaDetailScreen'
import { ContatosScreen } from '@/pages/ContatosScreen'
import { ComunicacoesScreen } from '@/pages/ComunicacoesScreen'
import { HistoricoScreen } from '@/pages/HistoricoScreen'
import { AdministracaoScreen } from '@/pages/AdministracaoScreen'
import {
  LoginScreen,
  ForgotPasswordScreen,
  ResetPasswordScreen,
  VerifyEmailScreen,
  ConfirmEmailChangeScreen,
} from '@/pages/AuthScreens'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas de Autenticação */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/verify-email" element={<VerifyEmailScreen />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChangeScreen />} />

          {/* Rotas Autenticadas com Layout Global */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/revendas" element={<RevendasScreen />} />
            <Route path="/revendas/:id" element={<RevendaDetailScreen />} />
            <Route path="/contatos" element={<ContatosScreen />} />
            <Route path="/comunicacoes" element={<ComunicacoesScreen />} />
            <Route path="/historico" element={<HistoricoScreen />} />

            {/* Rota Protegida exclusiva para Administrador */}
            <Route
              path="/administracao"
              element={
                <ProtectedRoute requireAdmin>
                  <AdministracaoScreen />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
