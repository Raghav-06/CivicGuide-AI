import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import SiteNav, { SiteFooter } from "../components/SiteNav";
import { useLang } from "../i18n";
import { API_BASE, apiRequest } from "../api/client";
import { checkAnswer, fieldKind } from "../../../shared/answerRules.js";
import { getService, checklistFor, CATEGORIES, STATES_AND_UTS } from "../../../shared/catalog/index.js";

/* ══════════════════════════════════════════════════════════════════════
   SERVICE GUIDE — one catalogue entry (or an AI-written guide) as an
   interactive checklist. Nothing here is sent anywhere except the
   optional question box and the prep-sheet PDF; ID numbers never are.
   ══════════════════════════════════════════════════════════════════════ */

/* Fields whose values are personal ID numbers: checked in the browser only, never stored or sent. */
const ID_KINDS = new Set(["aadhaar", "aadhaar_or_voter", "voter_id", "pan"]);
const isIdField = (f) => ID_KINDS.has(fieldKind(f));

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* ── Local storage (per service), always wrapped: private windows and blocked storage just don't persist ── */
const EMPTY_PROGRESS = { eligible: [], steps: [], docs: [], conditions: [], values: {} };
function loadProgress(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(`civiguide:guide:${id}`) ?? "null");
    return saved && typeof saved === "object" ? { ...EMPTY_PROGRESS, ...saved } : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}
function saveProgress(id, progress) {
  try { localStorage.setItem(`civiguide:guide:${id}`, JSON.stringify(progress)); } catch { /* not persisted */ }
}
function loadState() {
  try { return localStorage.getItem("civiguide:state") ?? ""; } catch { return ""; }
}
function saveState(value) {
  try { localStorage.setItem("civiguide:state", value); } catch { /* not persisted */ }
}

/* Re-renders when a CSS media query starts or stops matching. */
function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/* ── Small pieces ── */
const ExternalIcon = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);
const DownloadIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

function ProgressRing({ done, total, size = 76 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="progress-ring-track" />
      <circle cx={size / 2} cy={size / 2} r={r} className={`progress-ring-fill${pct === 1 ? " complete" : ""}`}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="progress-ring-text">{done}/{total}</text>
    </svg>
  );
}

/* A short burst of confetti; positions are fixed per piece so renders stay pure. */
const CONFETTI_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#f59e0b", "#ec4899"];
function Confetti({ burst }) {
  if (!burst) return null;
  return (
    <div className="confetti" key={burst} aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} style={{
          "--x": `${((i * 37) % 100) - 50}vw`, "--r": `${(i * 53) % 360}deg`, "--d": `${(i % 7) * 60}ms`,
          left: `${(i * 29) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        }} />
      ))}
    </div>
  );
}

function CopyButton({ value }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the value is visible to copy by hand */ }
  };
  return (
    <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={copy}>
      {copied ? `✓ ${t("copied")}` : t("copy")}
    </button>
  );
}

/* ── Field card with live "Check my value" ── */
function FieldCard({ field, value, onChange }) {
  const { t } = useLang();
  const text = value ?? "";
  const result = text.trim() ? checkAnswer(field, text) : null;
  const id = `check-${field.field}`;
  return (
    <article className="field-card">
      <header className="field-card-head">
        <h4>{field.label}</h4>
        <span className={`chip ${field.required ? "chip-required" : "chip-muted"}`}>{field.required ? t("required") : t("optional")}</span>
      </header>
      <dl className="field-meta">
        {field.format && <><dt>{t("format")}</dt><dd>{field.format}</dd></>}
        {field.example && <><dt>{t("example")}</dt><dd><code>{field.example}</code></dd></>}
        {field.where_to_find && <><dt>{t("where_to_find")}</dt><dd>{field.where_to_find}</dd></>}
        {field.options?.length > 0 && <><dt>Options</dt><dd>{field.options.join(" · ")}</dd></>}
      </dl>
      {field.common_mistakes?.length > 0 && (
        <div className="field-mistakes">
          <strong>{t("common_mistakes")}:</strong> {field.common_mistakes.join("; ")}
        </div>
      )}
      <label className="check-label" htmlFor={id}>{t("check_value")}</label>
      <div className="check-row">
        <input id={id} className={`check-input${result ? (result.error ? " invalid" : " valid") : ""}`}
          value={text} onChange={(e) => onChange(e.target.value)} placeholder={field.example || t("check_placeholder")}
          autoComplete="off" spellCheck={false} aria-describedby={`${id}-result`} />
      </div>
      <div id={`${id}-result`} aria-live="polite">
        {result?.error && <p className="check-result check-error">✗ {result.error}</p>}
        {result && !result.error && (
          <p className="check-result check-ok">
            <span className="check-pop">✓</span> {t("value_ok")}: <strong>{String(result.value)}</strong>
            <CopyButton value={result.value} />
          </p>
        )}
        {isIdField(field) && <p className="check-private">🔒 {t("id_note")}</p>}
      </div>
    </article>
  );
}

/* ── Ask a question ── */
function AskBox({ service }) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  useEffect(() => { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const body = service.ai_generated ? { service, question: q } : { id: service.id, question: q };
      const data = await apiRequest("/api/guide", { method: "POST", body });
      setMessages((m) => [...m, data.answer
        ? { role: "ai", text: data.answer, ai: true }
        : { role: "ai", intro: data.notice ?? t("ask_offline"), lines: data.excerpts?.length ? data.excerpts : null }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", intro: err.message || t("ask_error") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ask-box">
      <p className="section-intro">{t("ask_intro")}</p>
      <div className="ask-messages" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ask-msg ask-msg-user" : "ask-msg ask-msg-ai"}>
            {m.text && <p>{m.text}</p>}
            {m.ai && <span className="chip chip-ai">{t("ai_badge")}</span>}
            {m.intro && <p className="ask-intro">{m.intro}</p>}
            {m.intro && (m.lines
              ? <ul>{m.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
              : <p>{t("ask_nothing")}</p>)}
          </div>
        ))}
        {busy && <div className="ask-msg ask-msg-ai"><div className="typing-dots"><span /><span /><span /></div></div>}
      </div>
      <form className="ask-form" onSubmit={send}>
        <input className="check-input" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("ask_placeholder")} maxLength={500} aria-label={t("tab_ask")} />
        <button className="btn-primary" type="submit" disabled={!question.trim() || busy}>{t("ask_send")}</button>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function ServiceGuide({ serviceId, aiGuide, ...nav }) {
  const { t } = useLang();
  const service = aiGuide ?? getService(serviceId);
  if (!service) {
    return (
      <div className="app-root">
        <SiteNav {...nav} />
        <main className="guide-main">
          <div className="panel-card guide-not-found">
            <p>{t("not_found")}</p>
            <button className="btn-primary" onClick={nav.onGoExplore}>{t("back_to_explore")}</button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }
  return <GuideBody service={service} nav={nav} />;
}

function GuideBody({ service, nav }) {
  const { lang, t } = useLang();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [progress, setProgress] = useState(() => loadProgress(service.id));
  const [stateUT, setStateUT] = useState(loadState);
  const [tab, setTab] = useState("overview");
  const [celebrate, setCelebrate] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const tabRefs = useRef({});

  // ID numbers are never written to storage.
  useEffect(() => {
    const values = Object.fromEntries(Object.entries(progress.values)
      .filter(([k]) => !service.fields.some((f) => f.field === k && isIdField(f))));
    saveProgress(service.id, { ...progress, values });
  }, [progress, service]);

  const update = (key, fn) => setProgress((p) => ({ ...p, [key]: fn(p[key]) }));

  const docs = checklistFor(service, progress.conditions);
  const docsReady = docs.filter((d) => progress.docs.includes(d.name)).length;
  const eligibleCount = service.eligibility.filter((_, i) => progress.eligible.includes(i)).length;
  const stepsDone = service.steps.filter((_, i) => progress.steps.includes(i)).length;
  const total = service.eligibility.length + service.steps.length + docs.length;
  const overall = total ? Math.round(((eligibleCount + stepsDone + docsReady) / total) * 100) : 0;

  const toggleDoc = (name) => {
    const next = toggle(progress.docs, name);
    update("docs", () => next);
    // Celebrate when this tick completes the list (not when unticking).
    if (next.includes(name) && docs.every((d) => next.includes(d.name))) setCelebrate(Date.now());
  };

  const downloadPrep = async () => {
    setPdfError("");
    setPdfBusy(true);
    // Only valid, non-ID values are sent — checked again by the server.
    const values = {};
    for (const f of service.fields) {
      const v = progress.values[f.field];
      if (!v?.trim() || isIdField(f)) continue;
      const checked = checkAnswer(f, v);
      if (!checked.error) values[f.field] = checked.value;
    }
    try {
      const res = await fetch(`${API_BASE}/api/prep-sheet`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(service.ai_generated ? { service } : { id: service.id }),
          values, checked_documents: progress.docs, conditions: progress.conditions, done_steps: progress.steps,
          state: service.state_specific && stateUT ? stateUT : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${service.name.replace(/[^\w]+/g, "_")}_Preparation_Sheet.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError(t("prep_error"));
    } finally {
      setPdfBusy(false);
    }
  };

  const title = lang === "hi" && service.name_hi ? service.name_hi : service.name;
  const subtitle = lang === "hi" && service.name_hi ? service.name : service.name_hi;
  const category = CATEGORY_BY_ID[service.category];

  /* ── Sections ── */
  const overview = (
    <div className="guide-section">
      <p className="guide-summary">{service.summary}</p>
      <div className="chip-row">
        {service.modes.includes("online") && <span className="chip chip-online">{t("online")}</span>}
        {service.modes.includes("offline") && <span className="chip chip-offline">{t("offline")}</span>}
        {service.state_specific && <span className="chip chip-state">{t("state_specific_badge")}</span>}
      </div>
      {service.authority && <p className="guide-authority"><strong>{t("authority")}:</strong> {service.authority}</p>}
      {service.official_url
        ? <a className="btn-primary portal-btn" href={service.official_url} target="_blank" rel="noopener noreferrer">{t("official_portal")} <ExternalIcon /></a>
        : <p className="muted-note">{t("no_official_url")}</p>}
      <div className="info-chips">
        <div className="info-chip"><span>💰 {t("fees")}</span><p>{service.fees}</p></div>
        <div className="info-chip"><span>⏱ {t("timeline")}</span><p>{service.timeline}</p></div>
        {service.photo_signature_specs && <div className="info-chip"><span>📷 {t("photo_specs")}</span><p>{service.photo_signature_specs}</p></div>}
      </div>
      {service.state_specific && (
        <div className="state-box">
          <label htmlFor="state-select"><strong>{t("state_label")}</strong></label>
          <select id="state-select" className="check-input" value={stateUT}
            onChange={(e) => { setStateUT(e.target.value); saveState(e.target.value); }}>
            <option value="">{t("choose_state")}</option>
            {STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {service.state_notes && <p><strong>{t("state_notes_title")}{stateUT ? ` (${stateUT})` : ""}:</strong> {service.state_notes}</p>}
        </div>
      )}
      {service.last_reviewed && <p className="muted-note">{t("last_reviewed", { date: service.last_reviewed })}</p>}
    </div>
  );

  const missing = service.eligibility.filter((_, i) => !progress.eligible.includes(i));
  const eligibility = (
    <div className="guide-section">
      <p className="section-intro">{t("eligible_intro")}</p>
      <ul className="tick-list">
        {service.eligibility.map((item, i) => (
          <li key={i}>
            <label className={`tick-item${progress.eligible.includes(i) ? " ticked" : ""}`}>
              <input type="checkbox" checked={progress.eligible.includes(i)} onChange={() => update("eligible", (l) => toggle(l, i))} />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      {service.eligibility.length > 0 && (missing.length === 0
        ? <p className="result-banner result-ok"><span className="check-pop">✓</span> {t("eligible_yes")}</p>
        : <div className="result-banner result-pending">
            <p>{t("eligible_missing", { n: missing.length })}</p>
            <ul>{missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>)}
    </div>
  );

  const steps = (
    <div className="guide-section">
      <p className="section-intro">{t("steps_progress", { done: stepsDone, total: service.steps.length })}</p>
      <ol className="stepper">
        {service.steps.map((step, i) => {
          const done = progress.steps.includes(i);
          return (
            <li key={i} className={`step step-${step.mode}${done ? " done" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              <button className="step-dot" aria-pressed={done} aria-label={t("mark_done", { n: i + 1 })}
                onClick={() => update("steps", (l) => toggle(l, i))}>
                {done ? "✓" : i + 1}
              </button>
              <div className="step-body">
                <div className="step-title">
                  <h4>{step.title}</h4>
                  <span className={`chip chip-${step.mode === "both" ? "both" : step.mode}`}>
                    {step.mode === "online" ? `🌐 ${t("online_step")}` : step.mode === "offline" ? `🏢 ${t("offline_step")}` : t("both_step")}
                  </span>
                </div>
                <p>{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const fields = (
    <div className="guide-section">
      <p className="section-intro">🔒 {t("private_note")}</p>
      <div className="field-grid">
        {service.fields.map((f) => (
          <FieldCard key={f.field} field={f} value={progress.values[f.field]}
            onChange={(v) => update("values", (vals) => ({ ...vals, [f.field]: v }))} />
        ))}
      </div>
    </div>
  );

  const documents = (
    <div className="guide-section">
      {service.conditions.length > 0 && (
        <div className="conditions">
          <h4>{t("docs_conditions")}</h4>
          {service.conditions.map((c) => {
            const on = progress.conditions.includes(c.id);
            return (
              <div key={c.id} className="condition-row">
                <span id={`cond-${c.id}`}>{c.question}</span>
                <button role="switch" aria-checked={on} aria-labelledby={`cond-${c.id}`} className={`switch${on ? " on" : ""}`}
                  onClick={() => update("conditions", (l) => toggle(l, c.id))}>
                  <span className="switch-knob" />
                  <span className="switch-text">{on ? t("yes") : t("no")}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="docs-header">
        <ProgressRing done={docsReady} total={docs.length} />
        <p className="docs-progress-text" aria-live="polite">
          {docsReady === docs.length && docs.length ? `🎉 ${t("all_ready")}` : t("docs_progress", { done: docsReady, total: docs.length })}
        </p>
      </div>
      <ul className="doc-checklist">
        {docs.map((d) => {
          const ready = progress.docs.includes(d.name);
          return (
            <li key={d.name} className={`doc-check${ready ? " ready" : ""}${d.added_by ? " added" : ""}`}>
              <label>
                <input type="checkbox" checked={ready} onChange={() => toggleDoc(d.name)} />
                <span className="doc-check-body">
                  <span className="doc-check-name">
                    {d.name}
                    {!d.mandatory && <span className="chip chip-muted">{t("optional")}</span>}
                    {d.added_by && <span className="chip chip-state">{t("added_by_condition")}</span>}
                  </span>
                  {d.condition && <span className="doc-check-cond">{d.condition}</span>}
                  {d.accepted?.length > 0 && <span className="doc-check-meta"><strong>{t("accepted")}:</strong> {d.accepted.join(" · ")}</span>}
                  {d.specs && <span className="doc-check-meta">{d.specs}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const ruleCards = (titleKey, items, tone) => items?.length > 0 && (
    <div className={`rule-group rule-${tone}`}>
      <h4>{t(titleKey)}</h4>
      <div className="rule-cards">
        {items.map((r, i) => <div key={i} className="rule-card">{r}</div>)}
      </div>
    </div>
  );
  const rules = (
    <div className="guide-section">
      {service.legal_note && <p className="result-banner result-pending">⚖️ {t("legal_note")}</p>}
      {ruleCards("rules_title", service.rules.filter((r) => !/not legal advice/i.test(r)), "info")}
      {ruleCards("rejections_title", service.rejection_reasons, "warn")}
      {ruleCards("tips_title", service.tips, "tip")}
    </div>
  );

  const sections = [
    { id: "overview", label: t("tab_overview"), body: overview },
    { id: "eligible", label: t("tab_eligible"), body: eligibility, badge: `${eligibleCount}/${service.eligibility.length}` },
    { id: "steps", label: t("tab_steps"), body: steps, badge: `${stepsDone}/${service.steps.length}` },
    { id: "fields", label: t("tab_fields"), body: fields },
    { id: "documents", label: t("tab_documents"), body: documents, badge: `${docsReady}/${docs.length}` },
    { id: "rules", label: t("tab_rules"), body: rules },
    { id: "ask", label: t("tab_ask"), body: <AskBox service={service} /> },
  ];

  const activeTab = tab ?? "overview";   // the mobile accordion can close every section; tabs always show one

  /* Arrow keys move between tabs (WAI-ARIA tabs pattern). */
  const onTabKey = (e, i) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: sections.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = sections[(next + sections.length) % sections.length].id;
    setTab(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <div className="app-root">
      <SiteNav {...nav} />
      <div className="guide-progress-bar" role="progressbar" aria-label={t("progress_label")} aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100}>
        <div className="guide-progress-fill" style={{ width: `${overall}%` }} />
        <span className="guide-progress-text">{t("progress_label")}: {overall}%</span>
      </div>

      <main className="guide-main">
        <button className="back-link" onClick={nav.onGoExplore}>← {t("back_to_explore")}</button>

        <header className="guide-header animate-fade-in">
          <span className="guide-icon" aria-hidden="true">{category?.icon ?? "📄"}</span>
          <div>
            <h1 className="guide-title">{title}</h1>
            {subtitle && <p className="guide-subtitle" lang={lang === "hi" ? "en" : "hi"}>{subtitle}</p>}
            {service.ai_generated && <span className="chip chip-ai chip-large">✨ {t("ai_badge")}</span>}
          </div>
        </header>

        {isMobile ? (
          <div className="guide-accordion">
            {sections.map((s) => {
              const open = tab === s.id;
              return (
                <section key={s.id} className={`accordion-item${open ? " open" : ""}`}>
                  <h2>
                    <button className="accordion-head" aria-expanded={open} aria-controls={`acc-${s.id}`}
                      onClick={() => setTab(open ? null : s.id)}>
                      <span>{s.label}</span>
                      {s.badge && <span className="tab-badge">{s.badge}</span>}
                      <span className="accordion-chevron" aria-hidden="true">▾</span>
                    </button>
                  </h2>
                  {open && <div id={`acc-${s.id}`} className="accordion-body">{s.body}</div>}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="guide-tabs-wrap">
            <div className="guide-tabs" role="tablist" aria-label={service.name}>
              {sections.map((s, i) => (
                <button key={s.id} ref={(el) => { tabRefs.current[s.id] = el; }} role="tab" id={`tab-${s.id}`}
                  aria-selected={activeTab === s.id} aria-controls={`panel-${s.id}`} tabIndex={activeTab === s.id ? 0 : -1}
                  className={`guide-tab${activeTab === s.id ? " active" : ""}`} onClick={() => setTab(s.id)} onKeyDown={(e) => onTabKey(e, i)}>
                  {s.label}
                  {s.badge && <span className="tab-badge">{s.badge}</span>}
                </button>
              ))}
            </div>
            {sections.filter((s) => s.id === activeTab).map((s) => (
              <div key={s.id} role="tabpanel" id={`panel-${s.id}`} aria-labelledby={`tab-${s.id}`} className="guide-panel panel-card" tabIndex={0}>
                {s.body}
              </div>
            ))}
          </div>
        )}

        <section className="prep-card panel-card">
          <div>
            <h3>{t("download_prep")}</h3>
            <p>{t("prep_hint")}</p>
            {pdfError && <p className="check-result check-error">{pdfError}</p>}
          </div>
          <button className="btn-primary prep-btn" onClick={downloadPrep} disabled={pdfBusy}>
            {pdfBusy ? <><span className="pdf-spinner" /> {t("downloading")}</> : <><DownloadIcon /> {t("download_prep")}</>}
          </button>
        </section>
      </main>

      <Confetti burst={celebrate} />
      <SiteFooter />
    </div>
  );
}
