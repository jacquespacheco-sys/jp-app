import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthProvider.tsx'
import { CoachProvider } from './hooks/CoachProvider.tsx'
import { ContactsProvider } from './hooks/ContactsProvider.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { BottomNav } from './components/layout/BottomNav.tsx'
import { CoachFab } from './components/coach/CoachFab.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx'

const LoginPage = lazy(() => import('./pages/LoginPage.tsx').then(m => ({ default: m.LoginPage })))
const BriefingPage = lazy(() => import('./pages/BriefingPage.tsx').then(m => ({ default: m.BriefingPage })))
const TasksPage = lazy(() => import('./pages/TasksPage.tsx').then(m => ({ default: m.TasksPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage.tsx').then(m => ({ default: m.CalendarPage })))
const ContactsPage = lazy(() => import('./pages/ContactsPage.tsx').then(m => ({ default: m.ContactsPage })))
const ContactsOnboardingPage = lazy(() => import('./pages/ContactsOnboardingPage.tsx').then(m => ({ default: m.ContactsOnboardingPage })))
const ConfigPage = lazy(() => import('./pages/ConfigPage.tsx').then(m => ({ default: m.ConfigPage })))
const NotesPage = lazy(() => import('./pages/NotesPage.tsx').then(m => ({ default: m.NotesPage })))
const NewsPage = lazy(() => import('./pages/NewsPage.tsx').then(m => ({ default: m.NewsPage })))
const AreasPage = lazy(() => import('./pages/AreasPage.tsx').then(m => ({ default: m.AreasPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx').then(m => ({ default: m.DashboardPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage.tsx').then(m => ({ default: m.ProjectsPage })))
const CompassPage = lazy(() => import('./pages/CompassPage.tsx').then(m => ({ default: m.CompassPage })))
const HillWizardPage = lazy(() => import('./pages/HillWizardPage.tsx').then(m => ({ default: m.HillWizardPage })))
const HillRitualPage = lazy(() => import('./pages/HillRitualPage.tsx').then(m => ({ default: m.HillRitualPage })))
const CoachHillPage = lazy(() => import('./pages/CoachHillPage.tsx').then(m => ({ default: m.CoachHillPage })))
const HillPreferencesPage = lazy(() => import('./pages/HillPreferencesPage.tsx').then(m => ({ default: m.HillPreferencesPage })))
const HillNudgesPage = lazy(() => import('./pages/HillNudgesPage.tsx').then(m => ({ default: m.HillNudgesPage })))

const PageFallback = () => (
  <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  if (loading) return <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="app">
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
      <CoachFab onOpenProfile={() => navigate('/config?tab=coach')} />
      <BottomNav />
    </div>
  )
}

// Telas imersivas (wizard, rituais): full-screen, sem bottom-nav nem CoachFab
function ProtectedBare({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="empty-state" style={{ paddingTop: '40vh' }}>Carregando…</div>

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/briefing" replace /> : <Suspense fallback={<PageFallback />}><LoginPage /></Suspense>}
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
        path="/onboarding-contatos"
        element={<ProtectedRoute><ContactsOnboardingPage /></ProtectedRoute>}
      />
      <Route
        path="/config"
        element={<ProtectedRoute><ConfigPage /></ProtectedRoute>}
      />
      <Route
        path="/notes"
        element={<ProtectedRoute><NotesPage /></ProtectedRoute>}
      />
      <Route
        path="/news"
        element={<ProtectedRoute><NewsPage /></ProtectedRoute>}
      />
      <Route
        path="/areas"
        element={<ProtectedRoute><AreasPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
      />
      <Route
        path="/projects"
        element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>}
      />
      <Route
        path="/hill"
        element={<ProtectedRoute><CompassPage /></ProtectedRoute>}
      />
      <Route
        path="/hill/wizard"
        element={<ProtectedBare><HillWizardPage /></ProtectedBare>}
      />
      <Route
        path="/hill/ritual/:type"
        element={<ProtectedBare><HillRitualPage /></ProtectedBare>}
      />
      <Route
        path="/hill/coach"
        element={<ProtectedRoute><CoachHillPage /></ProtectedRoute>}
      />
      <Route
        path="/hill/preferences"
        element={<ProtectedRoute><HillPreferencesPage /></ProtectedRoute>}
      />
      <Route
        path="/hill/nudges"
        element={<ProtectedRoute><HillNudgesPage /></ProtectedRoute>}
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
          <CoachProvider>
            <ContactsProvider>
              <AppRoutes />
            </ContactsProvider>
          </CoachProvider>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
