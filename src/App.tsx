import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/AppLayout'

function PlayersPagePlaceholder() {
  return <div className="p-6 text-muted">Players page coming soon.</div>
}

function LineupBuilderPagePlaceholder() {
  return <div className="p-6 text-muted">Lineup builder coming soon.</div>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/players" replace />} />
            <Route path="/players" element={<PlayersPagePlaceholder />} />
            <Route path="/lineup" element={<LineupBuilderPagePlaceholder />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
