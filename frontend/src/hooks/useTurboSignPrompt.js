import { useCallback, useRef, useState } from 'react'
import { createElement } from 'react'
import SignExplainModal from '../components/SignExplainModal'

const SIGN_EXPLAINED_KEY = 'arkive_sign_explained'
const SIGN_EXPLAIN_MAX_MS = 500

/**
 * Promise-based hook for turboUpload `onSignPrompt` — brief in-app explanation before
 * MetaMask opens for the raw-byte storage signature. Skipped after first ack per session.
 */
export function useTurboSignPrompt() {
  const resolveRef = useRef(null)
  const autoTimerRef = useRef(null)
  const [open, setOpen] = useState(false)

  const finish = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    resolveRef.current?.()
    resolveRef.current = null
    setOpen(false)
    try {
      sessionStorage?.setItem(SIGN_EXPLAINED_KEY, '1')
    } catch {}
  }, [])

  const onSignPrompt = useCallback(() => {
    try {
      if (sessionStorage?.getItem(SIGN_EXPLAINED_KEY)) {
        return Promise.resolve()
      }
    } catch {}

    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOpen(true)
      autoTimerRef.current = setTimeout(finish, SIGN_EXPLAIN_MAX_MS)
    })
  }, [finish])

  const SignPromptModal = open ? createElement(SignExplainModal, { onContinue: finish }) : null

  return { onSignPrompt, SignPromptModal }
}
