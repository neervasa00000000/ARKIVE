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
import { DemoWalletProvider } from './context/DemoWalletContext'
import { DemoVaultProvider } from './context/DemoVaultContext'
import { assertDemoModeNotProduction, assertProductionSecrets } from './lib/security'

assertDemoModeNotProduction()
assertProductionSecrets()

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
            accentColor: '#fafafa',
            accentColorForeground: '#050505',
            borderRadius: 'large',
          })}
        >
          <DemoWalletProvider>
            <DemoVaultProvider>
              <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
                <Suspense fallback={<AppLoader />}>
                  <App />
                </Suspense>
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: '#141416',
                      color: '#fafafa',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '13px',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    },
                  }}
                />
              </BrowserRouter>
            </DemoVaultProvider>
          </DemoWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
