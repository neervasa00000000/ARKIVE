import { createContext, useContext, useState, useCallback } from 'react'
import {
  createInitialRecords,
  generateArweaveTxId,
  generateRecordId,
} from '../demo/demoVault'
import { DEMO_ADDRESS } from '../config/demo'

const DemoVaultContext = createContext(null)

export function DemoVaultProvider({ children }) {
  const [records, setRecords] = useState([])
  const [initialized, setInitialized] = useState(false)

  const initVault = useCallback(() => {
    if (!initialized) {
      setRecords(createInitialRecords())
      setInitialized(true)
    }
  }, [initialized])

  const resetVault = useCallback(() => {
    setRecords([])
    setInitialized(false)
  }, [])

  const addRecord = useCallback((file) => {
    const record = {
      id: generateRecordId(),
      fileName: file.name,
      sealedAt: Date.now(),
      lastOpenedAt: null,
      arweaveTxId: generateArweaveTxId(),
      walletAddress: DEMO_ADDRESS,
      fileType: guessFileType(file.name),
      _file: file,
    }
    setRecords((prev) => [record, ...prev])
    return record
  }, [])

  const markOpened = useCallback((id) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, lastOpenedAt: Date.now() } : r,
      ),
    )
  }, [])

  return (
    <DemoVaultContext.Provider
      value={{ records, initVault, resetVault, addRecord, markOpened }}
    >
      {children}
    </DemoVaultContext.Provider>
  )
}

export function useDemoVault() {
  const ctx = useContext(DemoVaultContext)
  if (!ctx) throw new Error('useDemoVault must be used within DemoVaultProvider')
  return ctx
}

function guessFileType(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video'
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document'
  return 'other'
}
