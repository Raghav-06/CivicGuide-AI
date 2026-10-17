import { useEffect, useRef, useState } from "react";
import CiviGuideAI from "./CiviGuideAI";
import Application from "./Application";
import FormSession from "./FormSession";
import VerifyEmail from "./VerifyEmail";
import Explore from "./Explore";
import ServiceGuide from "./ServiceGuide";
import { LangContext, loadLang, saveLang } from "../i18n";

/* The Explore and Guide pages have their own URLs (/explore, /services/<id>) so they can be shared and bookmarked. */
function routeFromPath(pathname) {
  if (pathname === "/verify-email") return { page: "verify" };
  if (pathname === "/explore") return { page: "explore" };
  const m = pathname.match(/^\/services\/([a-z0-9-]+)\/?$/);
  if (m) return { page: "guide", serviceId: m[1] };
  return { page: "home" };
}

function pathFor(page, serviceId) {
  if (page === "explore") return "/explore";
  if (page === "guide") return `/services/${serviceId}`;
  return "/";
}

export default function App() {
  const [route,        setRoute]        = useState(() => routeFromPath(window.location.pathname));
  const [selectedForm, setSelectedForm] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [aiGuide,      setAiGuide]      = useState(null);   // AI-written guide for a service not in the catalogue
  const [lang,         setLangState]    = useState(loadLang);
  const scrollTarget = useRef(null);   // element id to scroll to once the next page renders
  const { page } = route;

  const setLang = (next) => { setLangState(next); saveLang(next); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Back / forward between Explore and guides.
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!scrollTarget.current) return;
    document.getElementById(scrollTarget.current)?.scrollIntoView({ behavior: "smooth" });
    scrollTarget.current = null;
  }, [page]);

  const go = (next, serviceId) => {
    const path = pathFor(next, serviceId);
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
    setRoute({ page: next, serviceId });
    window.scrollTo(0, 0);
  };

  const goHome        = () => go("home");
  const goApplication = () => go("application");
  const goExplore     = () => go("explore");
  const goHowItWorks  = () => { scrollTarget.current = "how-it-works"; go("home"); };
  const openGuide     = (id, guide = null) => {
    if (guide) setAiGuide(guide);
    go("guide", id);
  };

  const goSession = (formName, fileObj = null) => {
    setSelectedForm(formName);
    setUploadedFile(fileObj ?? null);
    go("session");
  };

  const nav = { onGoHome: goHome, onGoHowItWorks: goHowItWorks, onGoExplore: goExplore, onGoApplication: goApplication };

  let content;
  if (page === "verify") {
    content = (
      <VerifyEmail
        onDone={() => { window.history.replaceState(null, "", "/"); setRoute({ page: "home" }); }}
      />
    );
  } else if (page === "explore") {
    content = <Explore {...nav} onOpenGuide={openGuide} />;
  } else if (page === "guide") {
    content = (
      <ServiceGuide
        {...nav}
        key={route.serviceId}
        serviceId={route.serviceId}
        aiGuide={aiGuide?.id === route.serviceId ? aiGuide : null}
      />
    );
  } else if (page === "session") {
    content = (
      <FormSession
        selectedForm={selectedForm}
        uploadedFile={uploadedFile}
        onGoHome={goHome}
        onGoApplication={goApplication}
        onGoHowItWorks={goHowItWorks}
        onGoExplore={goExplore}
        onOpenGuide={openGuide}
      />
    );
  } else if (page === "application") {
    content = (
      <Application
        onSelectForm={goSession}
        onGoHome={goHome}
        onGoHowItWorks={goHowItWorks}
        onGoExplore={goExplore}
        onOpenGuide={openGuide}
      />
    );
  } else {
    content = <CiviGuideAI onGoApplication={goApplication} onGoExplore={goExplore} />;
  }

  return <LangContext.Provider value={{ lang, setLang }}>{content}</LangContext.Provider>;
}
