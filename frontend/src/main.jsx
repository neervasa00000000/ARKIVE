import './index.css'
import '@rainbow-me/rainbowkit/styles.css'

import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { wagmiConfig } from './config/wagmi'
import Landing from './pages/Landing'

const App = lazy(() => import('./App'))

const queryClient = new QueryClient()

function AppLoader() {
  return <Landing />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#00E5FF',
            accentColorForeground: '#0A0B0F',
            borderRadius: 'medium',
          })}
        >
            <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
            <Suspense fallback={<AppLoader />}>
              <App />
            </Suspense>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#1A1D2A',
                  color: '#E8E8F4',
                  border: '1px solid #1E2235',
                  fontFamily: 'Inter, sans-serif',
                },
              }}
            />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
