import { useEffect, useRef, useState } from "react";
import CiviGuideAI from "./CiviGuideAI";
import Application from "./Application";
import FormSession from "./FormSession";
import VerifyEmail from "./VerifyEmail";

export default function App() {
  // The emailed verification link lands on /verify-email; everything else starts at home.
  const [page,         setPage]         = useState(() =>
    window.location.pathname === "/verify-email" ? "verify" : "home");
  const [selectedForm, setSelectedForm] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const scrollTarget = useRef(null);   // element id to scroll to once the next page renders

  useEffect(() => {
    if (!scrollTarget.current) return;
    document.getElementById(scrollTarget.current)?.scrollIntoView({ behavior: "smooth" });
    scrollTarget.current = null;
  }, [page]);

  const goHome        = () => { setPage("home");        window.scrollTo(0, 0); };
  const goApplication = () => { setPage("application"); window.scrollTo(0, 0); };
  const goHowItWorks  = () => { scrollTarget.current = "how-it-works"; setPage("home"); };

  const goSession = (formName, fileObj = null) => {
    setSelectedForm(formName);
    setUploadedFile(fileObj ?? null);
    setPage("session");
    window.scrollTo(0, 0);
  };

  if (page === "verify") {
    return (
      <VerifyEmail
        onDone={() => { window.history.replaceState(null, "", "/"); goHome(); }}
      />
    );
  }

  if (page === "session") {
    return (
      <FormSession
        selectedForm={selectedForm}
        uploadedFile={uploadedFile}
        onGoHome={goHome}
        onGoApplication={goApplication}
        onGoHowItWorks={goHowItWorks}
      />
    );
  }

  if (page === "application") {
    return (
      <Application
        onSelectForm={goSession}
        onGoHome={goHome}
        onGoHowItWorks={goHowItWorks}
      />
    );
  }

  return <CiviGuideAI onGoApplication={goApplication} />;
}
