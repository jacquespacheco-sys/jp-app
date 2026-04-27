import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthProvider.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { BottomNav } from './components/layout/BottomNav.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { BriefingPage } from './pages/BriefingPage.tsx'
import { TasksPage } from './pages/TasksPage.tsx'
import { CalendarPage } from './pages/CalendarPage.tsx'
import { ContactsPage } from './pages/ContactsPage.tsx'
import { ConfigPage } from './pages/ConfigPage.tsx'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="app">
      {children}
      <BottomNav />
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/briefing" replace /> : <LoginPage />}
      />
      <Route
        path="/briefing"
        element={<ProtectedRoute><BriefingPage /></ProtectedRoute>}
      />
      <Route
        path="/tasks"
        element={<ProtectedRoute><TasksPage /></ProtectedRoute>}
      />
      <Route
        path="/calendar"
        element={<ProtectedRoute><CalendarPage /></ProtectedRoute>}
      />
      <Route
        path="/contacts"
        element={<ProtectedRoute><ContactsPage /></ProtectedRoute>}
      />
      <Route
        path="/config"
        element={<ProtectedRoute><ConfigPage /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to="/briefing" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
