import NavAuth from "../components/NavAuth";
import { useState, useRef, useEffect } from "react";
import { getBackendStatus } from "../api/client";
import { useAuth } from "../auth/authContext";
/* ── Icons ── */
const Shield = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
const Upload = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);
const FileText = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);
const ChevronUp = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const MenuIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);
const CheckCircle = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
  </svg>
);
const XIcon = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const ArrowRight = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

/* ── Data ── */
const FORMS = [
  { emoji: "🛂", label: "Passport Application",        sub: "Government form" },
  { emoji: "💰", label: "Income Certificate",           sub: "Government form" },
  { emoji: "🏠", label: "Residence Proof Certificate",  sub: "Government form" },
  { emoji: "👶", label: "Birth Certificate",            sub: "Government form" },
];

/* ── Helpers ── */
const flatBtn = { background: "none", border: "none", cursor: "pointer", padding: 0 };

/* Derive a friendly form title from a PDF / DOCX filename */
function labelFromFilename(filename) {
  return filename
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/* ═══════════════════════════════════════
   COMPONENT
   Props:
     onSelectForm(formLabel)  — navigate to FormSession
     onGoHome()               — navigate back to landing
     onGoHowItWorks()         — navigate to the landing page's "How It Works" section
   ═══════════════════════════════════════ */
export default function Application({ onSelectForm, onGoHome, onGoHowItWorks }) {
  const [mobileOpen,         setMobileOpen]         = useState(false);
  const [showMobilePreview,  setShowMobilePreview]  = useState(false);
  const [selectedForm,       setSelectedForm]       = useState(null);  // label string
  const [uploadedFile,       setUploadedFile]       = useState(null);  // { name, label, size }
  const [dragOver,           setDragOver]           = useState(false);
  const [uploadError,        setUploadError]        = useState("");
  const [formLink,           setFormLink]           = useState("");    // URL of an online form / notice
  const [linkError,          setLinkError]          = useState("");

  const [backend,            setBackend]            = useState(null);  // null = checking; else getBackendStatus()
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  /* Uploading your own form needs AI (Engine 1 reads it) — find out before the user tries. */
  useEffect(() => {
    let cancelled = false;
    getBackendStatus().then((status) => { if (!cancelled) setBackend(status); });
    return () => { cancelled = true; };
  }, []);

  const uploadBlocked = backend === null ? null
    : !backend.online ? "Uploading your own form needs the AI backend, which isn't reachable right now. The ready-made forms above work offline."
    : !backend.aiEnabled ? "Uploading your own form needs AI, which isn't configured on this server. The ready-made forms above work with built-in rules."
    : backend.aiRequiresLogin && !user ? "Sign in to upload your own form — reading it uses AI. The ready-made forms above work without an account."
    : null;

  /* ── Handle a file object coming from input or drop ── */
  const processFile = (file) => {
    setUploadError("");
    if (!file || uploadBlocked) return;

    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setUploadError("Only PDF and Word (.docx) files are accepted.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File is too large. Maximum allowed size is 20 MB.");
      return;
    }

    const label = labelFromFilename(file.name);
    const sizeKB = Math.round(file.size / 1024);
    const sizeText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    setUploadedFile({ name: file.name, label, size: sizeText, file });
    setSelectedForm(label); // pre-select in the preview panel too
  };

  /* file <input> change */
  const onInputChange = (e) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
    // Reset so picking the same file again re-triggers onChange
    e.target.value = "";
  };

  /* drag & drop */
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = ()  => setDragOver(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  /* clear uploaded file */
  const clearFile = () => {
    setUploadedFile(null);
    setSelectedForm(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* card form select → navigate immediately */
  const selectCard = (label) => {
    clearFile();
    if (onSelectForm) onSelectForm(label);
  };

  /* Start with uploaded form */
  const startWithUpload = () => {
    if (uploadedFile && onSelectForm) onSelectForm(uploadedFile.label, uploadedFile);
  };

  /* Start with an online form (e.g. an exam registration page) — the server reads the link. */
  const startWithLink = (e) => {
    e.preventDefault();
    setLinkError("");
    if (uploadBlocked) return;
    const text = formLink.trim();
    let url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      url = null;
    }
    if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) {
      setLinkError("Enter the full web address of the form, e.g. https://example.gov.in/apply.");
      return;
    }
    const label = url.hostname.replace(/^www\./, "");
    onSelectForm?.(label, { name: label, label, url: url.href });
  };

  return (
    <div className="app-root">

      {/* ── NAV ── */}
      <nav className="glass-panel nav-sticky">
        <div className="nav-inner">
          <button style={flatBtn} className="nav-brand" onClick={() => onGoHome?.()}>
            <div className="gradient-primary-bg nav-brand-icon">
              <Shield size={20} style={{ color: "hsl(210,40%,98%)" }} />
            </div>
            <span className="nav-brand-text">CiviGuide AI</span>
          </button>

          <div className="nav-links hide-mobile">
            <button style={flatBtn} className="nav-link" onClick={() => onGoHome?.()}>Home</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoHowItWorks?.()}>How It Works</button>
            <button style={flatBtn} className="nav-link">Start Application</button>
            <button className="btn-primary" style={{ height: 36, padding: "0 12px" }}>Get Started</button>
            <NavAuth />
          </div>

          <button className="nav-mobile-btn hide-desktop" onClick={() => setMobileOpen(o => !o)}>
            <MenuIcon size={24} />
          </button>
        </div>

        {mobileOpen && (
          <div className="nav-mobile-menu hide-desktop">
            <button style={flatBtn} className="nav-link" onClick={() => onGoHome?.()}>Home</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoHowItWorks?.()}>How It Works</button>
            <button style={flatBtn} className="nav-link">Start Application</button>
            <button className="btn-primary" style={{ height: 40, padding: "0 16px" }}>Get Started</button>
            <NavAuth />
          </div>
        )}
      </nav>

      {/* ── MAIN ── */}
      <main className="main-content">
        <div className="app-grid">

          {/* ── LEFT: Upload / Select Panel ── */}
          <div className="panel-card shadow-card">
            <div className="upload-panel-body">
              <div className="upload-icon-wrap gradient-primary-bg">
                <Upload size={24} style={{ color: "hsl(210,40%,98%)" }} />
              </div>

              <h3 className="upload-title">Upload or Select a Form</h3>
              <p className="upload-desc">
                Choose a government form below, or upload your own PDF or Word form — our AI will guide you through every field.
              </p>

              {/* ── Form cards ── */}
              <div className="form-selector-grid">
                {FORMS.map(({ emoji, label, sub }) => (
                  <button
                    key={label}
                    className="form-option-btn"
                    onClick={() => selectCard(label)}
                    style={selectedForm === label && !uploadedFile
                      ? { borderColor: "hsl(221.2,83.2%,53.3%)", boxShadow: "0 0 0 2px rgba(99,102,241,0.2)" }
                      : {}}
                  >
                    <span className="form-option-emoji">{emoji}</span>
                    <div>
                      <span className="form-option-label">{label}</span>
                      <span className="form-option-sublabel">{sub}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* ── Divider ── */}
              <div className="divider-or">
                <div className="divider-line" />
                <span className="divider-text">or upload your own form</span>
                <div className="divider-line" />
              </div>

              {/* ── PDF Drop Zone / Uploaded Pill ── */}
              {!uploadedFile ? (
                <>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                    style={{ display: "none" }}
                    onChange={onInputChange}
                  />

                  {/* Drop zone */}
                  <div
                    className={`pdf-drop-zone${dragOver && !uploadBlocked ? " drag-active" : ""}${uploadBlocked ? " drop-zone-disabled" : ""}`}
                    onClick={() => !uploadBlocked && fileInputRef.current?.click()}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    role="button"
                    tabIndex={uploadBlocked ? -1 : 0}
                    aria-disabled={Boolean(uploadBlocked)}
                    onKeyDown={(e) => e.key === "Enter" && !uploadBlocked && fileInputRef.current?.click()}
                  >
                    <div className="drop-zone-icon">
                      <Upload size={22} />
                    </div>
                    <p className="drop-zone-title">
                      {dragOver ? "Drop your form here" : "Click to browse or drag & drop"}
                    </p>
                    <p className="drop-zone-sub">PDF or DOCX · Max 20 MB{uploadBlocked ? " · needs AI" : ""}</p>
                  </div>

                  {uploadBlocked && <p className="drop-zone-notice">{uploadBlocked}</p>}

                  {/* Error message */}
                  {uploadError && (
                    <p className="upload-error">{uploadError}</p>
                  )}

                  {/* ── Online form by link ── */}
                  <div className="divider-or">
                    <div className="divider-line" />
                    <span className="divider-text">or paste a link to an online form</span>
                    <div className="divider-line" />
                  </div>
                  <form className="link-form" onSubmit={startWithLink}>
                    <input
                      className="link-input"
                      type="text"
                      inputMode="url"
                      placeholder="https://… exam registration or application page"
                      value={formLink}
                      onChange={(e) => { setFormLink(e.target.value); setLinkError(""); }}
                      disabled={Boolean(uploadBlocked)}
                      aria-label="Link to an online form"
                    />
                    <button type="submit" className="btn-primary link-submit" disabled={Boolean(uploadBlocked) || !formLink.trim()}>
                      Read Form <ArrowRight size={16} />
                    </button>
                  </form>
                  <p className="drop-zone-sub link-hint">
                    The form page itself, or its official notice (web page or PDF). We&apos;ll list the details it asks for and check your answers.
                  </p>
                  {linkError && <p className="upload-error">{linkError}</p>}
                </>
              ) : (
                /* ── Uploaded file pill ── */
                <div className="uploaded-pill">
                  <div className="uploaded-pill-icon">
                    <CheckCircle size={18} style={{ color: "var(--success)" }} />
                  </div>
                  <div className="uploaded-pill-info">
                    <span className="uploaded-pill-name">{uploadedFile.name}</span>
                    <span className="uploaded-pill-meta">{uploadedFile.size} · uploaded successfully</span>
                  </div>
                  <button className="uploaded-pill-clear" onClick={clearFile} title="Remove file">
                    <XIcon size={14} />
                  </button>
                </div>
              )}

              {/* ── Start button shown after upload ── */}
              {uploadedFile && (
                <button
                  className="btn-primary"
                  style={{ marginTop: "1rem", height: 42, padding: "0 1.5rem", width: "100%", maxWidth: "28rem" }}
                  onClick={startWithUpload}
                >
                  Start Filling &quot;{uploadedFile.label}&quot; <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* ── Mobile preview toggle ── */}
          <div className="mobile-preview-toggle">
            <button className="btn-ghost" style={{ width: "100%" }} onClick={() => setShowMobilePreview(o => !o)}>
              <FileText size={16} />
              Show Form Preview
              <ChevronUp size={16} style={{ marginLeft: "auto" }} />
            </button>
          </div>

          {/* ── RIGHT: Preview Panel ── */}
          <div className={`panel-card shadow-card preview-panel-desktop${showMobilePreview ? " show-mobile" : ""}`}>
            <div className="preview-panel-empty">
              <FileText size={40} style={{ color: "rgba(107,114,128,0.3)", marginBottom: 12 }} />
              {uploadedFile ? (
                <>
                  <p className="preview-panel-empty-title">📄 {uploadedFile.name}</p>
                  <p className="preview-panel-empty-desc" style={{ color: "var(--success)", fontWeight: 600 }}>
                    ✓ Form uploaded · {uploadedFile.size}
                  </p>
                  <p className="preview-panel-empty-desc" style={{ marginTop: 8 }}>
                    Click "Start Filling" to begin the AI-guided session
                  </p>
                </>
              ) : selectedForm ? (
                <>
                  <p className="preview-panel-empty-title">{selectedForm}</p>
                  <p className="preview-panel-empty-desc">Click the card to launch your AI-guided session</p>
                </>
              ) : (
                <>
                  <p className="preview-panel-empty-title">No form selected yet</p>
                  <p className="preview-panel-empty-desc">Upload a PDF / DOCX or choose a form above to get started</p>
                </>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="footer-root">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-brand-row">
                <div className="gradient-primary-bg footer-brand-icon">
                  <Shield size={16} style={{ color: "hsl(210,40%,98%)" }} />
                </div>
                <span className="footer-brand-name">CiviGuide AI</span>
              </div>
              <p className="footer-brand-desc">Transforming complex government forms into simple conversations.</p>
            </div>
            <div>
              <h4 className="footer-col-title">Product</h4>
              <button style={flatBtn} className="footer-link" onClick={() => onGoHome?.()}>Home</button>
              <button style={flatBtn} className="footer-link">Start Application</button>
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