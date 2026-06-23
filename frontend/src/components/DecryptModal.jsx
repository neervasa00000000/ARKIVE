import { useState } from 'react'
import { X, Lock, Download, Shield, AlertTriangle, ChevronDown } from 'lucide-react'
import { useVault } from '../hooks/useVault'
import { vaultErrorMessage } from '../lib/setupStatus'
import toast from 'react-hot-toast'

export default function DecryptModal({ file, onClose }) {
  const { retrieveAndDecryptFile, loading, step } = useVault()
  const [decrypted, setDecrypted] = useState(null)
  const [litFailed, setLitFailed] = useState(false)
  const [showManual, setShowManual] = useState(false)

  async function handleDecrypt() {
    try {
      toast('Sign your wallet to decrypt', { icon: '🔐' })
      const result = await retrieveAndDecryptFile(file.encryptedArweaveId, false)
      setDecrypted(result)
      toast.success('File decrypted')
    } catch (error) {
      if (error.message?.includes('Lit') || error.message?.includes('session')) {
        setLitFailed(true)
        toast.error('Lit Protocol unavailable. Use wallet fallback below.')
      } else {
        toast.error(vaultErrorMessage(error))
      }
    }
  }

  async function handleWalletFallback() {
    try {
      toast('Sign the derivation message in MetaMask to decrypt', { icon: '🔐' })
      const result = await retrieveAndDecryptFile(file.encryptedArweaveId, true)
      setDecrypted(result)
      toast.success('File decrypted using wallet fallback')
    } catch (error) {
      toast.error('Wallet fallback failed. Make sure you are using the original wallet that encrypted this file.')
    }
  }

  function handleDownload() {
    if (!decrypted) return
    const a = document.createElement('a')
    a.href = decrypted.url
    a.download = decrypted.fileName
    a.click()
  }

  function handleClose() {
    decrypted?.cleanup?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-elevated border border-border rounded-2xl w-full max-w-lg animate-slide-up">

        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Lock size={18} className="text-purple-400 shrink-0" />
            <h2 className="font-display text-lg font-semibold text-text-primary truncate">
              {file.fileName}
            </h2>
          </div>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">

          {!decrypted ? (
            <div>

              <div className="text-center py-4">
                <div className="h-16 w-16 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={28} className="text-purple-400" />
                </div>
                <p className="font-body text-text-secondary text-sm leading-relaxed mb-6">
                  This file is encrypted. Sign your wallet to prove ownership and decrypt it.
                  The file is never permanently decrypted — it is only visible temporarily in this session.
                </p>

                {loading && step && (
                  <div className="bg-card border border-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
                    <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="font-mono text-xs text-text-secondary">{step}</span>
                  </div>
                )}
              </div>

              {!litFailed ? (
                <button
                  onClick={handleDecrypt}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white py-3 rounded-xl font-display font-semibold text-sm hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
                >
                  <Lock size={16} />
                  {loading ? 'Decrypting...' : 'Sign to Decrypt'}
                </button>
              ) : null}

              <button
                onClick={handleWalletFallback}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3 ${
                  litFailed
                    ? 'bg-purple-500 text-white hover:bg-purple-400'
                    : 'bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20'
                }`}
              >
                <Shield size={16} />
                {loading
                  ? 'Decrypting...'
                  : litFailed
                    ? 'Decrypt with Wallet (Lit unavailable)'
                    : 'Use Wallet Fallback Instead'}
              </button>

              {litFailed && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-display text-xs font-semibold text-amber-300 mb-1">
                        Lit Protocol Unavailable
                      </p>
                      <p className="font-body text-xs text-amber-300/80 leading-relaxed">
                        The wallet fallback path works without Lit Protocol.
                        Sign the derivation message when MetaMask prompts you.
                        Your files are safe — this fallback was built in from day one.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowManual(!showManual)}
                className="w-full flex items-center justify-between py-2 text-text-muted hover:text-text-secondary transition-colors text-xs font-mono"
              >
                <span>Manual recovery (advanced)</span>
                <ChevronDown size={14} className={`transition-transform ${showManual ? 'rotate-180' : ''}`} />
              </button>

              {showManual && (
                <div className="bg-card border border-border rounded-xl p-4 mt-2">
                  <p className="font-mono text-xs text-text-secondary leading-relaxed mb-3">
                    If both paths above fail, you can decrypt manually in any browser console:
                  </p>
                  <div className="space-y-2">
                    {[
                      `1. Fetch the payload: await fetch("https://arweave.net/${file.encryptedArweaveId}").then(r=>r.json())`,
                      '2. Sign: await ethereum.request({method:"personal_sign",params:["ARKIVE_VAULT_KEY_DERIVATION_V1_DO_NOT_SIGN_IN_ANY_OTHER_CONTEXT", yourAddress]})',
                      '3. Hash the signature with keccak256 — this is your derived AES key',
                      '4. AES-GCM decrypt walletEncryptedAesKey using derived key + walletEncryptedAesKeyIv',
                      '5. AES-GCM decrypt encryptedFile using result + encryptedFileIv',
                      '6. File bytes are your original file',
                    ].map((s, i) => (
                      <p key={i} className="font-mono text-xs text-text-muted leading-relaxed">{s}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 mt-3">
                <div className="flex items-start gap-2">
                  <Shield size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                  <p className="font-mono text-xs text-text-muted leading-relaxed">
                    This file is protected by dual encryption. Even if ARKIVE and Lit Protocol both disappear,
                    your wallet signature alone can decrypt it from Arweave permanently.
                  </p>
                </div>
              </div>
            </div>

          ) : (
            <div>
              {decrypted.fileType?.startsWith('image/') && (
                <img
                  src={decrypted.url}
                  alt={decrypted.fileName}
                  className="w-full rounded-xl mb-4 max-h-96 object-contain"
                />
              )}
              {decrypted.fileType === 'application/pdf' && (
                <iframe
                  src={decrypted.url}
                  className="w-full h-64 rounded-xl mb-4"
                  title={decrypted.fileName}
                />
              )}
              {!decrypted.fileType?.startsWith('image/') && decrypted.fileType !== 'application/pdf' && (
                <div className="bg-card border border-border rounded-xl p-8 text-center mb-4">
                  <p className="font-body text-text-secondary text-sm">
                    File decrypted successfully. Download to open.
                  </p>
                </div>
              )}

              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white py-3 rounded-xl font-display font-semibold text-sm hover:bg-purple-400 transition-colors"
              >
                <Download size={16} />
                Download {decrypted.fileName}
              </button>

              <p className="font-mono text-xs text-text-muted text-center mt-3">
                File will be removed from memory when you close this modal
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
