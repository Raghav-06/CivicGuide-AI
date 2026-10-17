import { useState } from "react";
import NavAuth from "./NavAuth";
import { useLang } from "../i18n";

const Shield = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
const MenuIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const flatBtn = { background: "none", border: "none", cursor: "pointer", padding: 0 };

/* Nav for the Explore and Guide pages: same look as the other pages, plus the English / हिन्दी toggle. */
export default function SiteNav({ active, onGoHome, onGoHowItWorks, onGoExplore, onGoApplication }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang, t } = useLang();

  const links = (
    <>
      <button style={flatBtn} className="nav-link" onClick={onGoHome}>{t("nav_home")}</button>
      <button style={flatBtn} className="nav-link" onClick={onGoHowItWorks}>{t("nav_how")}</button>
      <button style={flatBtn} className={`nav-link${active === "explore" ? " nav-link-active" : ""}`} onClick={onGoExplore}
        aria-current={active === "explore" ? "page" : undefined}>{t("nav_explore")}</button>
      <button style={flatBtn} className="nav-link" onClick={onGoApplication}>{t("nav_start")}</button>
      <button className="lang-toggle" onClick={() => setLang(lang === "en" ? "hi" : "en")}
        aria-label={t("lang_toggle_label")} lang={lang === "en" ? "hi" : "en"}>
        {t("lang_toggle")}
      </button>
      <NavAuth />
    </>
  );

  return (
    <nav className="glass-panel nav-sticky">
      <div className="nav-inner">
        <button style={flatBtn} className="nav-brand" onClick={onGoHome}>
          <div className="gradient-primary-bg nav-brand-icon">
            <Shield size={20} />
          </div>
          <span className="nav-brand-text">CiviGuide AI</span>
        </button>
        <div className="nav-links hide-mobile">{links}</div>
        <button className="nav-mobile-btn hide-desktop" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen} aria-label="Menu">
          <MenuIcon size={24} />
        </button>
      </div>
      {mobileOpen && <div className="nav-mobile-menu hide-desktop">{links}</div>}
    </nav>
  );
}

/* Footer for the Explore and Guide pages, with the guidance disclaimer. */
export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="footer-root">
      <div className="footer-inner">
        <p className="guide-disclaimer" role="note">ⓘ {t("footer_disclaimer")}</p>
        <div className="footer-bottom">
          <p className="footer-copyright">© 2026 CiviGuide AI. Built for public accessibility.</p>
        </div>
      </div>
    </footer>
  );
}
