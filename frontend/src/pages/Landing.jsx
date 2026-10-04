import WalletButton from '../components/WalletButton'
import { useEffect } from 'react'
import Logo from '../components/Logo'
import { isDemoMode } from '../config/demo'
import { ArrowDown, ArrowRight, Check, FileText, Fingerprint, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

const steps = [
  { number: '01', title: 'Choose a file', description: 'Start with a test file. Your original stays with you.' },
  { number: '02', title: 'Encrypt in your browser', description: 'Your file is sealed on your device before upload.' },
  { number: '03', title: 'Open when you need it', description: 'Use an authorised wallet or your recovery passphrase.' },
]

export default function Landing() {
  useEffect(() => { document.title = 'ARKIVE · Your private file archive' }, [])

  return (
    <div className="landing-shell app-bg min-h-screen">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="landing-header landing-container">
        <Logo />
        <div className="landing-header-right">
          <span className="landing-network"><i /> {isDemoMode ? 'Interactive demo' : 'Base Sepolia testnet'}</span>
          <a href="#how" className="landing-header-link">How it works <ArrowDown size={14} /></a>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><Sparkles size={14} /> A private space for important files</p>
            <h1 id="landing-title">Your files,<br /><em>held close.</em></h1>
            <p className="landing-lead">Explore a calmer way to store and retrieve encrypted files. ARKIVE seals each file in your browser and gives you a clear record of where it goes.</p>
            <div className="landing-actions">
              <WalletButton label={isDemoMode ? 'Explore the demo' : 'Connect your wallet'} />
              <a href="#how" className="landing-secondary-link">See how it works <ArrowRight size={16} /></a>
            </div>
            <p className="landing-caution"><ShieldCheck size={16} /> Testnet preview. Use test files and keep your originals. Long-term preservation is not yet available.</p>
          </div>

          <div className="landing-art" role="img" aria-label="Illustration of a file encrypted in the browser and stored in a private vault">
            <div className="art-orbit art-orbit-one" aria-hidden="true" />
            <div className="art-orbit art-orbit-two" aria-hidden="true" />
            <div className="art-float art-float-top"><span className="art-mini-icon"><Fingerprint size={16} /></span><span>Only you hold the key</span><Check size={15} /></div>
            <div className="art-vault">
              <div className="art-vault-top"><span><span className="art-live-dot" /> PRIVATE VAULT</span><span>01 / 03</span></div>
              <div className="art-file-mark"><FileText size={36} strokeWidth={1.4} /><span><LockKeyhole size={14} /></span></div>
              <p className="art-file-title">Your next chapter</p>
              <p className="art-file-subtitle">Encrypted before upload</p>
              <div className="art-vault-progress"><span /></div>
              <div className="art-vault-bottom"><span><Check size={14} /> Browser encrypted</span><span>Ready to store</span></div>
            </div>
            <div className="art-float art-float-bottom"><ShieldCheck size={18} /><span><strong>Private by design</strong><small>Access stays in your hands</small></span></div>
          </div>
        </section>

        <section id="how" className="landing-how landing-container" aria-labelledby="how-title">
          <div className="landing-section-intro"><p className="landing-kicker">THE SIMPLE PATH</p><h2 id="how-title">A clear process, from start to finish.</h2><p>Every step is visible, so you always know what happens to your file.</p></div>
          <div className="landing-steps">
            {steps.map((step) => <article className="landing-step" key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container"><Logo size="sm" /><span>ARKIVE is currently a testnet preview.</span></footer>
    </div>
  )
}
