import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAccount } from 'wagmi'
import Landing from './pages/Landing'

const Feed = lazy(() => import('./pages/Feed'))
const Vault = lazy(() => import('./pages/Vault'))
const Profile = lazy(() => import('./pages/Profile'))
const Recovery = lazy(() => import('./pages/Recovery'))
const Layout = lazy(() => import('./components/Layout'))

function RouteLoader() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <p className="font-mono text-sm text-text-secondary">Loading…</p>
    </div>
  )
}

function RecoveryShell({ children }) {
  const { isConnected } = useAccount()

  if (isConnected) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Layout>{children}</Layout>
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <span className="font-display text-xl font-bold text-text-primary">
            ARK<span className="text-cyan-400">IVE</span>
          </span>
        </div>
        <Suspense fallback={<RouteLoader />}>{children}</Suspense>
      </div>
    </div>
  )
}

export default function App() {
  const { isConnected } = useAccount()

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
