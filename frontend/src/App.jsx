import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { useWalletState } from './hooks/useWalletState'
import Landing from './pages/Landing'
import AppLoader from './components/AppLoader'

const Feed = lazy(() => import('./pages/Feed'))
const Vault = lazy(() => import('./pages/Vault'))
const Profile = lazy(() => import('./pages/Profile'))
const Layout = lazy(() => import('./components/Layout'))

export default function App() {
  const wallet = useWalletState()
  const { isConnected } = wallet

  // Keep the URL intact while wagmi restores its connection. Disconnected is final
  // only after this settles; showing Landing sooner causes the home-page flash.
  if (wallet.isRestoring) return <AppLoader />

  return (
    <Routes>
      <Route
        path="/*"
        element={
          isConnected ? (
            <Suspense fallback={<AppLoader />}>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/vault" replace />} />
                  <Route path="/vault" element={<Vault />} />
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
