import { useEffect } from 'react'
import WalletButton from '../components/WalletButton'
import Logo from '../components/Logo'
import { isDemoMode } from '../config/demo'
import { ArrowDown, ArrowUpRight, ArrowRight, LockKeyhole, FileText, Fingerprint } from 'lucide-react'

const steps = [
  { number: '01', title: 'Choose what stays.', description: 'Documents, photographs, a piece of your work. Start with a test file and keep the original.', icon: FileText },
  { number: '02', title: 'Seal it on your device.', description: 'In the live vault, your browser encrypts the file before anything leaves your device.', icon: LockKeyhole },
  { number: '03', title: 'Keep the keys.', description: 'Open with an authorised wallet. Add a recovery passphrase and keep an offline archive copy.', icon: Fingerprint },
]

function ArchiveObject() {
  return <div className="archive-object" aria-label="An archival folder containing a photograph, a document, and an encrypted file" role="img">
    <div className="object-caption"><span>THE PERSONAL ARCHIVE</span><span>FIG. 001</span></div>
    <div className="archive-stack" aria-hidden="true">
      <div className="archive-sheet sheet-back"><div className="sheet-label">FIELD NOTES / 2026</div><div className="sheet-lines" /><div className="sheet-lines short" /></div>
      <div className="archive-sheet sheet-photo"><div className="landscape"><div className="landscape-sun" /><div className="landscape-ridge ridge-back" /><div className="landscape-ridge ridge-front" /></div><span>Somewhere worth remembering.</span></div>
      <div className="archive-folder"><div className="folder-tab">ARKIVE — 001</div><div className="folder-face"><div className="folder-meta"><span>PERSONAL COLLECTION</span><LockKeyhole size={18} /></div><p>Keep it.<br />Keep the keys.</p><div className="folder-bottom"><span>PRIVATE BY DESIGN</span><div className="archive-barcode" /></div></div></div>
    </div>
    <div className="object-baseline"><span><span className="status-square" /> ENCRYPTED IN YOUR BROWSER</span><span>01 — 03</span></div>
  </div>
}

export default function Landing() {
  useEffect(() => { document.title = 'ARKIVE · Keep it. Keep the keys.' }, [])
  return <div className="archive-landing">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="archive-header archive-container"><a href="#main-content" aria-label="ARKIVE home"><Logo /></a><nav aria-label="Main"><a href="#how">The process <ArrowDown size={14} /></a><span className="edition-label">{isDemoMode ? 'INTERACTIVE DEMO' : 'TESTNET EDITION'}<span className="status-square" /></span></nav></header>
    <main id="main-content">
      <section className="archive-hero archive-container" aria-labelledby="landing-title">
        <div className="archive-hero-copy"><p className="archive-eyebrow"><span /> YOUR FILES. YOUR CUSTODY.</p><h1 id="landing-title">Some things<br />are worth<br /><span>keeping.</span></h1><p className="archive-intro">A personal archive for what matters.<br />Encrypted on your device. Opened with your keys.</p><div className="archive-cta"><WalletButton label={isDemoMode ? 'Enter the demo' : 'Open your vault'} /><ArrowUpRight size={22} aria-hidden="true" /></div><p className="archive-disclosure">{isDemoMode ? 'Sample records. No wallet or payment needed.' : 'Connect a wallet to begin. Base Sepolia testnet.'}</p></div>
        <ArchiveObject />
      </section>
      <div className="archive-principles archive-container"><span><span className="principle-number">01</span> Browser encryption</span><span><span className="principle-number">02</span> Keys in your custody</span><span><span className="principle-number">03</span> Independent recovery</span><a href="#how" aria-label="Explore how ARKIVE works"><ArrowDown size={20} /></a></div>
      <section id="how" className="archive-process archive-container"><div className="process-heading"><p className="archive-eyebrow">THE PROCESS / 01—03</p><h2>What goes in.<br />What stays yours.</h2><p>Three steps, with a record of each.<br />No mystery about where your file goes.</p></div><div className="process-steps">{steps.map(({ number, title, description, icon: Icon }) => <article key={number}><div className="process-index"><span>{number}</span><Icon size={21} strokeWidth={1.5} /></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section className="archive-note archive-container"><span className="archive-eyebrow">A NOTE ON THIS EDITION</span><p>ARKIVE is a testnet prototype. Use test files and keep your originals and an independent backup. Testnet storage is not a long-term preservation guarantee.</p><a href="https://github.com/neervasa00000000/ARKIVE" target="_blank" rel="noopener noreferrer" className="archive-source">Built in the open <ArrowUpRight size={16} /></a></section>
    </main>
    <footer className="archive-footer archive-container"><Logo size="sm" /><span>KEEP IT. KEEP THE KEYS.</span><a href="#main-content">Back to top <ArrowRight size={15} /></a></footer>
  </div>
}
