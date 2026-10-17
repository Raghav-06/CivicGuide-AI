import { useEffect, useMemo, useState } from "react";
import SiteNav, { SiteFooter } from "../components/SiteNav";
import { useLang } from "../i18n";
import { apiRequest } from "../api/client";
import { SERVICES, CATEGORIES, searchServices, highlightParts } from "../../../shared/catalog/index.js";

const SearchIcon = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const SparkleIcon = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
);

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* Text with the words matching `query` wrapped in <mark>. */
export function Highlight({ text, query }) {
  if (!query) return text;
  return highlightParts(text, query).map((p, i) => (p.match ? <mark key={i} className="search-mark">{p.text}</mark> : p.text));
}

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/* One search result / browse card. */
function ServiceCard({ service, query, onOpen, index, aiGenerated = false }) {
  const { lang, t } = useLang();
  const category = CATEGORY_BY_ID[service.category];
  const primary = lang === "hi" && service.name_hi ? service.name_hi : service.name;
  const secondary = lang === "hi" && service.name_hi ? service.name : service.name_hi;
  return (
    <button className="service-card" onClick={onOpen} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <span className="service-card-icon" aria-hidden="true">{category?.icon ?? "📄"}</span>
      <span className="service-card-body">
        <span className="service-card-name"><Highlight text={primary} query={query} /></span>
        {secondary && <span className="service-card-alt" lang={lang === "hi" ? "en" : "hi"}><Highlight text={secondary} query={query} /></span>}
        {service.summary && <span className="service-card-summary"><Highlight text={service.summary} query={query} /></span>}
        <span className="chip-row">
          {aiGenerated && <span className="chip chip-ai"><SparkleIcon size={12} /> {t("ai_badge")}</span>}
          {service.modes?.includes("online") && <span className="chip chip-online">{t("online")}</span>}
          {service.modes?.includes("offline") && <span className="chip chip-offline">{t("offline")}</span>}
          {service.state_specific && <span className="chip chip-state">{t("state_specific_badge")}</span>}
        </span>
      </span>
      <span className="service-card-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function SkeletonCards({ count = 3 }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="service-card skeleton-card" aria-hidden="true">
      <span className="skeleton skeleton-icon" />
      <span className="service-card-body">
        <span className="skeleton skeleton-line" style={{ width: "55%" }} />
        <span className="skeleton skeleton-line" style={{ width: "90%" }} />
        <span className="skeleton skeleton-line" style={{ width: "70%" }} />
      </span>
    </div>
  ));
}

export default function Explore({ onGoHome, onGoHowItWorks, onGoExplore, onGoApplication, onOpenGuide }) {
  const { lang, t } = useLang();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const [mode, setMode] = useState("any");
  const [ask, setAsk] = useState(null);   // { query, status: "loading" | "done" | "error", guide, matches, notice, error }
  const debounced = useDebounced(query.trim(), 150);

  // Text matches first (with relevance order), then the category and online/offline filters.
  const textMatches = useMemo(
    () => (debounced ? searchServices(debounced).map((r) => r.service) : SERVICES),
    [debounced],
  );
  const modeMatches = useMemo(
    () => (mode === "any" ? textMatches : textMatches.filter((s) => s.modes.includes(mode))),
    [textMatches, mode],
  );
  const results = category ? modeMatches.filter((s) => s.category === category) : modeMatches;
  const counts = useMemo(() => {
    const c = {};
    for (const s of modeMatches) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, [modeMatches]);

  const askCiviGuide = async (q) => {
    setAsk({ query: q, status: "loading" });
    try {
      const data = await apiRequest("/api/guide", { method: "POST", body: { query: q } });
      setAsk({ query: q, status: "done", guide: data.guide, matches: data.matches ?? [], notice: data.notice });
    } catch (err) {
      // Server unreachable, rate-limited or sign-in required: still offer the loosest local matches.
      const loose = [...new Map(q.split(/\s+/).flatMap((w) => searchServices(w)).map(({ service }) => [service.id, service])).values()].slice(0, 5);
      setAsk({ query: q, status: "error", error: err.message, matches: loose });
    }
  };

  const showAskResult = ask && ask.query === debounced;
  const nav = { onGoHome, onGoHowItWorks, onGoExplore, onGoApplication };

  return (
    <div className="app-root">
      <SiteNav active="explore" {...nav} />

      <main className="explore-main">
        <section className="explore-hero gradient-subtle-bg">
          <div className="explore-hero-inner animate-fade-in">
            <div className="badge-pill" style={{ width: "fit-content", margin: "0 auto" }}>
              <span className="badge-dot animate-pulse-soft" /> {t("explore_badge")}
            </div>
            <h1 className="explore-title">{t("explore_title")}</h1>
            <p className="explore-sub">{t("explore_sub")}</p>

            <div className="search-box">
              <SearchIcon size={20} />
              <input
                type="search"
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                aria-label={t("search_label")}
                autoFocus
              />
            </div>

            <div className="mode-filter" role="radiogroup" aria-label="Online / offline">
              {[["any", t("filter_any")], ["online", t("filter_online")], ["offline", t("filter_offline")]].map(([value, label]) => (
                <button key={value} role="radio" aria-checked={mode === value}
                  className={`mode-pill${mode === value ? " active" : ""}`} onClick={() => setMode(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="explore-body">
          <div className="category-grid" role="group" aria-label="Categories">
            <button className={`category-tile${category === null ? " active" : ""}`} aria-pressed={category === null} onClick={() => setCategory(null)}>
              <span className="category-icon" aria-hidden="true">✨</span>
              <span className="category-label">{t("all_categories")}</span>
              <span className="category-count">{modeMatches.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`category-tile${category === c.id ? " active" : ""}`}
                aria-pressed={category === c.id} disabled={!counts[c.id] && category !== c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}>
                <span className="category-icon" aria-hidden="true">{c.icon}</span>
                <span className="category-label">{lang === "hi" ? c.label_hi : c.label}</span>
                <span className="category-count">{counts[c.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <p className="results-count" aria-live="polite">
            {results.length === 1 ? t("results_one") : t("results_count", { n: results.length })}
          </p>

          <div className="results-grid" key={`${category}|${mode}|${debounced}`}>
            {results.map((s, i) => (
              <ServiceCard key={s.id} service={s} query={debounced} index={i} onOpen={() => onOpenGuide(s.id)} />
            ))}
          </div>

          {debounced && (
            <div className={`ask-panel${results.length ? " ask-panel-subtle" : ""}`}>
              {!results.length && <p className="ask-empty">{t("no_results", { q: debounced })}</p>}
              {!(showAskResult && ask.status !== "error") && (
                <button className="btn-primary ask-btn" onClick={() => askCiviGuide(debounced)}
                  disabled={showAskResult && ask.status === "loading"}>
                  <SparkleIcon size={16} /> {t("ask_civiguide", { q: debounced })}
                </button>
              )}

              {showAskResult && ask.status === "loading" && (
                <div className="results-grid" aria-busy="true">
                  <p className="results-count">{t("asking")}</p>
                  <SkeletonCards count={2} />
                </div>
              )}

              {showAskResult && ask.status !== "loading" && (
                <div className="results-grid">
                  {ask.guide && (
                    <ServiceCard service={ask.guide} query="" index={0} aiGenerated onOpen={() => onOpenGuide(ask.guide.id, ask.guide)} />
                  )}
                  {!ask.guide && (
                    <p className="results-count">
                      {ask.notice || ask.error ? `${ask.notice ?? ask.error} ` : ""}
                      {ask.matches?.length ? t("ai_unavailable") : t("no_close_match")}
                    </p>
                  )}
                  {!ask.guide && ask.matches?.map((s, i) => (
                    <ServiceCard key={s.id} service={s} query={debounced} index={i + 1} onOpen={() => onOpenGuide(s.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
