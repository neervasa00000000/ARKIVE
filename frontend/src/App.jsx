import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { useWalletState } from './hooks/useWalletState'
import Landing from './pages/Landing'
import Logo from './components/Logo'
import AppLoader from './components/AppLoader'

const Feed = lazy(() => import('./pages/Feed'))
const Vault = lazy(() => import('./pages/Vault'))
const Profile = lazy(() => import('./pages/Profile'))
const Recovery = lazy(() => import('./pages/Recovery'))
const Activity = lazy(() => import('./pages/Activity'))
const Layout = lazy(() => import('./components/Layout'))

function RecoveryShell({ children }) {
  const wallet = useWalletState()
  const { isConnected } = wallet

  if (isConnected) {
    return (
      <Suspense fallback={<AppLoader />}>
        <Layout>{children}</Layout>
      </Suspense>
    )
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Logo />
        </div>
        <Suspense fallback={<AppLoader />}>{children}</Suspense>
      </div>
    </div>
  )
}

export default function App() {
  const wallet = useWalletState()
  const { isConnected } = wallet

  // Keep the URL intact while wagmi restores its connection. Disconnected is final
  // only after this settles; showing Landing sooner causes the home-page flash.
  if (wallet.isRestoring) return <AppLoader />

  return (
    <Routes>
      <Route
        path="/recover"
        element={
          <RecoveryShell>
            <Recovery />
          </RecoveryShell>
        }
      />
      <Route
        path="/*"
        element={
          isConnected ? (
            <Suspense fallback={<AppLoader />}>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/vault" replace />} />
                  <Route path="/vault" element={<Vault />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/community" element={<Feed />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/vault" replace />} />
                </Routes>
              </Layout>
            </Suspense>
          ) : (
            <Landing />
          )
        }
      />
    </Routes>
  )
}
