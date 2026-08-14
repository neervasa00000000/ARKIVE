import { useRef } from 'react'
import { Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatSealedDate } from '../demo/demoVault'
import { DEMO_ADDRESS_SHORT } from '../config/demo'
import { escapeHtml } from '../lib/security'
import { Modal, ModalHeader, ModalBody } from './Modal'

export default function PermanenceCertificate({ record, onClose }) {
  const printRef = useRef()

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    const safeName = escapeHtml(record.fileName || 'record')
    const safeTx = escapeHtml(record.arweaveTxId || '')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ARKIVE Permanence Certificate — ${safeName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; color: #1a1a1a; padding: 48px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 24px; margin-bottom: 32px; }
            .title { font-size: 28px; letter-spacing: 4px; font-weight: normal; }
            .subtitle { font-size: 12px; letter-spacing: 2px; margin-top: 8px; color: #666; }
            .field { margin-bottom: 20px; }
            .label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
            .value { font-size: 14px; font-family: monospace; word-break: break-all; }
            .qr { text-align: center; margin: 32px 0; }
            .footer { border-top: 1px solid #ccc; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 11px; color: #888; line-height: 1.6; }
            .seal { display: inline-block; border: 2px solid #1a1a1a; border-radius: 50%; width: 80px; height: 80px; line-height: 76px; text-align: center; font-size: 10px; letter-spacing: 1px; color: #1a1a1a; margin-top: 16px; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  const certUrl = `https://arkive.app/cert/${record.arweaveTxId}`

  return (
    <Modal onClose={onClose} size="max-w-lg" zIndex="z-[70]">
      <ModalHeader
        title="Permanence Certificate"
        onClose={onClose}
        description="Proof your record lives on Arweave forever."
      />
      <ModalBody>
        <div className="flex justify-end -mt-2 mb-4">
          <button
            type="button"
            onClick={handlePrint}
            className="btn-ghost text-xs gap-1.5"
            title="Print certificate"
          >
            <Printer size={15} />
            Print
          </button>
        </div>

        <div ref={printRef}>
          <div className="text-center border-b border-line pb-6 mb-6">
            <p className="font-display text-2xl tracking-[0.3em] text-ink">ARKIVE</p>
            <p className="font-mono text-xs text-faint tracking-widest uppercase mt-2">
              Permanence Certificate
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-mono text-xs text-faint mb-1">Record</p>
              <p className="text-ink">{record.fileName}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-faint mb-1">Date sealed</p>
              <p className="text-ink">{formatSealedDate(record.sealedAt)}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-faint mb-1">Arweave TX ID</p>
              <p className="font-mono text-xs text-ink break-all">{record.arweaveTxId}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-faint mb-1">Wallet address</p>
              <p className="font-mono text-xs text-muted break-all">
                {record.walletAddress || DEMO_ADDRESS_SHORT}
              </p>
            </div>
          </div>

          <div className="flex justify-center my-8">
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={certUrl} size={140} level="M" />
            </div>
          </div>

          <div className="text-center border-t border-line pt-6">
            <div className="inline-flex h-16 w-16 rounded-full border-2 border-line items-center justify-center mb-3">
              <span className="font-mono text-[9px] text-muted tracking-wider">SEALED</span>
            </div>
            <p className="text-faint text-xs leading-relaxed max-w-xs mx-auto">
              This record is permanent. It cannot be removed from the blockchain. That is the point.
            </p>
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}
