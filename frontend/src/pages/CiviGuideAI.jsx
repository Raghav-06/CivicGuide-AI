import NavAuth from "../components/NavAuth";
import { useState } from "react";
/* ── Icons ── */
const Shield = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
const MessageSquare = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const ArrowRight = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);
const FileWarning = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);
const TriangleAlert = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);
const CircleX = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
  </svg>
);
const CircleHelp = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
  </svg>
);
const Users = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const Upload = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);
const Brain = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" />
    <path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" />
  </svg>
);
const MessageCircle = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);
const ShieldCheck = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const Download = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);
const Lock = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Eye = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const Globe = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
);
const Scale = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);
const FileText = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);
const CircleCheckBig = ({ size = 12 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" />
  </svg>
);
const MenuIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

/* ── Data ── */
const PROBLEMS = [
  { Icon: FileWarning,   title: "Complex Legal Language",       desc: "Forms use jargon that's hard for everyday citizens to understand." },
  { Icon: TriangleAlert, title: "Strict Formatting Rules",      desc: "One wrong field format can lead to instant rejection." },
  { Icon: CircleX,       title: "Frequent Rejection",           desc: "Over 40% of government applications are rejected due to errors." },
  { Icon: CircleHelp,    title: "Missing Documents Confusion",  desc: "Unclear requirements leave applicants guessing what to submit." },
  { Icon: Users,         title: "Manual Agent Dependency",      desc: "Citizens often must hire agents or visit offices repeatedly." },
];

const STEPS = [
  { Icon: Upload,        label: "Step 1", title: "Upload or Select Form",   desc: "Choose your government form or upload a PDF." },
  { Icon: Brain,         label: "Step 2", title: "AI Simplifies Questions", desc: "Complex fields become plain-language questions." },
  { Icon: MessageCircle, label: "Step 3", title: "You Answer Naturally",    desc: "Just type your answers in conversation." },
  { Icon: ShieldCheck,   label: "Step 4", title: "AI Validates & Checks",  desc: "Auto-detect errors and missing information." },
  { Icon: Download,      label: "Step 5", title: "Download Ready Form",     desc: "Get a submission-ready, perfectly formatted document." },
];

const TRUST = [
  { Icon: Lock,  title: "Secure & Private",        desc: "End-to-end encryption for all your data." },
  { Icon: Eye,   title: "No Data Without Consent", desc: "Nothing stored without your explicit permission." },
  { Icon: Globe, title: "Built for Public Access",  desc: "Designed for universal accessibility standards." },
  { Icon: Scale, title: "Compliance Ready",         desc: "Built to meet government compliance requirements." },
];

/* ─────────────────────────────────────────────────────
   COMPONENT
   Props:
   - onGoApplication()  → navigate to Application page
   ───────────────────────────────────────────────────── */
export default function CiviGuideAI({ onGoApplication }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // All CTAs call this
  const goApp = () => { if (onGoApplication) onGoApplication(); };

  // Smooth scroll to How It Works section
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  // Reusable inline button style to strip native button styles
  const flatBtn = { background: "none", border: "none", cursor: "pointer", padding: 0 };

  return (
    <div className="app-root">

      {/* ── NAV ── */}
      <nav className="glass-panel nav-sticky">
        <div className="nav-inner">
          {/* Logo stays on home */}
          <button style={flatBtn} className="nav-brand">
            <div className="gradient-primary-bg nav-brand-icon">
              <Shield size={20} />
            </div>
            <span className="nav-brand-text">CiviGuide AI</span>
          </button>

          {/* Desktop */}
          <div className="nav-links hide-mobile">
            <button style={flatBtn} className="nav-link">Home</button>
            <button style={flatBtn} className="nav-link" onClick={scrollToHowItWorks}>How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={goApp}>Start Application</button>
            <button className="btn-primary" style={{ height: 36, padding: "0 12px" }} onClick={goApp}>
              Get Started
            </button>
            <NavAuth />
          </div>

          {/* Mobile hamburger */}
          <button className="nav-mobile-btn hide-desktop" onClick={() => setMobileOpen(o => !o)}>
            <MenuIcon size={24} />
          </button>
        </div>

        {mobileOpen && (
          <div className="nav-mobile-menu hide-desktop">
            <button style={flatBtn} className="nav-link">Home</button>
            <button style={flatBtn} className="nav-link" onClick={scrollToHowItWorks}>How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={goApp}>Start Application</button>
            <button className="btn-primary" style={{ height: 40, padding: "0 16px" }} onClick={goApp}>
              Get Started
            </button>
            <NavAuth />
          </div>
        )}
      </nav>

      <main style={{ flex: 1 }}>

        {/* ── HERO ── */}
        <section className="gradient-subtle-bg">
          <div className="hero-section">
            <div className="hero-grid">

              {/* Left */}
              <div className="hero-left animate-fade-in">
                <div className="badge-pill" style={{ width: "fit-content" }}>
                  <span className="badge-dot animate-pulse-soft" />
                  AI-Powered Government Form Assistant
                </div>

                <h1 className="hero-title">
                  Intelligent Government Form{" "}
                  <span className="gradient-text">Auto-Navigator</span>
                </h1>

                <p className="hero-description">
                  We transform complex government forms into simple conversations
                  and generate submission-ready documents.
                </p>

                <div className="hero-cta-group">
                  {/* ── PRIMARY CTA ── */}
                  <button className="btn-primary" style={{ height: 44, padding: "0 2rem" }} onClick={goApp}>
                    Start Application <ArrowRight size={16} />
                  </button>
                  <button className="btn-outline" style={{ height: 44, padding: "0 2rem" }} onClick={scrollToHowItWorks}>
                    How It Works
                  </button>
                </div>
              </div>

              {/* Right — Preview Card (decorative) */}
              <div className="preview-wrapper animate-fade-in-right hide-mobile" style={{ animationDelay: "0.2s" }}>
                <div className="preview-card shadow-elevated">
                  <div className="preview-header">
                    <div className="gradient-primary-bg preview-header-icon">
                      <MessageSquare size={14} />
                    </div>
                    <span className="preview-header-title">CiviGuide Assistant</span>
                    <span className="preview-header-progress">40% Complete</span>
                  </div>
                  <div className="preview-chat">
                    <div className="chat-ai">What is your full legal name as it appears on your ID?</div>
                    <div className="chat-user">John Michael Smith</div>
                    <div className="chat-ai">Great! What is your date of birth?</div>
                  </div>
                </div>

                {/* Floating mini card */}
                <div className="mini-card shadow-elevated">
                  <div className="mini-card-header">
                    <FileText size={16} style={{ color: "hsl(221.2,83.2%,53.3%)" }} />
                    <span className="mini-card-title">Live Form Preview</span>
                  </div>
                  <div className="mini-card-rows">
                    <div className="mini-card-row">
                      <CircleCheckBig size={12} style={{ color: "var(--success)" }} />
                      <span className="mini-card-row-text">Full Name: John M. Smith</span>
                    </div>
                    <div className="mini-card-row">
                      <div className="warning-dot" />
                      <span className="mini-card-row-text">Date of Birth: ...</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── WHY FORMS ARE HARD ── */}
        <section style={{ padding: "5rem 0", background: "var(--card)" }}>
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">Why Government Forms Are Hard</h2>
              <p className="section-description">Millions struggle with bureaucratic paperwork every day. Here's why.</p>
            </div>
            <div className="cards-grid-5">
              {PROBLEMS.map(({ Icon, title, desc }, i) => (
                <div key={i} className="feature-card shadow-card animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="icon-wrap"><Icon size={20} /></div>
                  <h3 className="card-title">{title}</h3>
                  <p className="card-desc">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="gradient-subtle-bg" style={{ padding: "5rem 0" }}>
          <div className="section-container">
            <div className="section-header" style={{ marginBottom: "3.5rem" }}>
              <h2 className="section-title">How It Works</h2>
              <p className="section-description">Five simple steps from confusion to completion.</p>
            </div>

            {/* Desktop */}
            <div className="steps-desktop hide-mobile">
              <div className="steps-desktop-line" />
              {STEPS.map(({ Icon, label, title, desc }, i) => (
                <div key={i} className="step-item-desktop animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className="step-circle"><Icon size={20} /></div>
                  <span className="step-label">{label}</span>
                  <h3 className="step-title">{title}</h3>
                  <p className="step-desc">{desc}</p>
                </div>
              ))}
            </div>

            {/* Mobile */}
            <div className="steps-mobile hide-desktop">
              {STEPS.map(({ Icon, label, title, desc }, i) => (
                <div key={i} className="step-item-mobile animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="step-circle-sm"><Icon size={16} /></div>
                  <div>
                    <span className="step-label">{label}</span>
                    <h3 className="step-title">{title}</h3>
                    <p className="step-desc">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className="gradient-subtle-bg" style={{ padding: "5rem 0" }}>
          <div className="section-container">
            <div className="section-header-wide">
              <h2 className="section-title">About CiviGuide AI</h2>
              <p style={{ color: "var(--muted-fg)", lineHeight: 1.75, fontSize: "1.125rem" }}>
                CiviGuide AI is an automated adaptation system that reduces bureaucratic friction by
                converting rigid legal forms into intelligent conversational workflows. Our mission is
                to make government services accessible to every citizen, regardless of literacy level
                or technical expertise.
              </p>
            </div>
          </div>
        </section>

        {/* ── TRUST ── */}
        <section style={{ padding: "5rem 0", background: "var(--card)" }}>
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">Built on Trust</h2>
              <p className="section-description">Security and accessibility are at the core of everything we build.</p>
            </div>
            <div className="cards-grid-4">
              {TRUST.map(({ Icon, title, desc }, i) => (
                <div key={i} className="feature-card shadow-card animate-fade-in" style={{ textAlign: "center", animationDelay: `${i * 0.1}s` }}>
                  <div className="icon-wrap-round"><Icon size={20} /></div>
                  <h3 className="card-title" style={{ fontSize: "0.875rem" }}>{title}</h3>
                  <p className="card-desc" style={{ fontSize: "0.75rem" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="footer-root">
        <div className="footer-inner">
          <div className="footer-grid">

            <div className="footer-brand">
              <div className="footer-brand-row">
                <div className="gradient-primary-bg footer-brand-icon">
                  <Shield size={16} />
                </div>
                <span className="footer-brand-name">CiviGuide AI</span>
              </div>
              <p className="footer-brand-desc">
                Transforming complex government forms into simple conversations.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Product</h4>
              <button style={flatBtn} className="footer-link">Home</button>
              {/* ── Footer CTA → Application ── */}
              <button style={flatBtn} className="footer-link" onClick={goApp}>Start Application</button>
            </div>

            <div>
              <h4 className="footer-col-title">Legal</h4>
              <a href="#" className="footer-link">Privacy Policy</a>
              <a href="#" className="footer-link">Terms of Service</a>
            </div>

            <div>
              <h4 className="footer-col-title">Connect</h4>
              <a href="#" className="footer-link">Contact</a>
              <a href="#" className="footer-link">GitHub</a>
              <span className="footer-badge">🏆 Hackathon Project</span>
            </div>

          </div>

          <div className="footer-bottom">
            <p className="footer-copyright">© 2026 CiviGuide AI. Built for public accessibility.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}