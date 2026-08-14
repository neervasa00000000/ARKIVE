import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { isDemoMode } from './config/demo'
import { useWalletState } from './hooks/useWalletState'
import Landing from './pages/Landing'
import Logo from './components/Logo'

const Feed = lazy(() => import('./pages/Feed'))
const Vault = lazy(() => import('./pages/Vault'))
const Profile = lazy(() => import('./pages/Profile'))
const Recovery = lazy(() => import('./pages/Recovery'))
const Layout = lazy(() => import('./components/Layout'))

function RouteLoader() {
  return (
    <div className="app-bg min-h-screen flex items-center justify-center">
      <p className="font-mono text-sm text-muted animate-pulse">Loading…</p>
    </div>
  )
}

function RecoveryShell({ children }) {
  const wallet = useWalletState()
  const wagmi = useAccount()
  const isConnected = isDemoMode ? wallet.isConnected : wagmi.isConnected

  if (isConnected) {
    return (
      <Suspense fallback={<RouteLoader />}>
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
        <Suspense fallback={<RouteLoader />}>{children}</Suspense>
      </div>
    </div>
  )
}

export default function App() {
  const wallet = useWalletState()
  const wagmi = useAccount()
  const isConnected = isDemoMode ? wallet.isConnected : wagmi.isConnected

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
            <Suspense fallback={<RouteLoader />}>
              <Layout>
                <Routes>
                  <Route path="/" element={<Feed />} />
                  <Route path="/vault" element={<Vault />} />
                  <Route path="/profile" element={<Profile />} />
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
