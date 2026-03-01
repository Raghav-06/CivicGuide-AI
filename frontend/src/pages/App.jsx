import { useState } from "react";
import CiviGuideAI from "./CiviGuideAI";
import Application from "./Application";
import FormSession from "./FormSession";  
export default function App() {
  const [page,         setPage]         = useState("home");
  const [selectedForm, setSelectedForm] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const goHome        = () => { setPage("home");        window.scrollTo(0, 0); };
  const goApplication = () => { setPage("application"); window.scrollTo(0, 0); };

  const goSession = (formName, fileObj = null) => {
    setSelectedForm(formName);
    setUploadedFile(fileObj ?? null);
    setPage("session");
    window.scrollTo(0, 0);
  };

  if (page === "session") {
    return (
      <FormSession
        selectedForm={selectedForm}
        uploadedFile={uploadedFile}
        onGoHome={goHome}
        onGoApplication={goApplication}
      />
    );
  }

  if (page === "application") {
    return (
      <Application
        onSelectForm={goSession}
        onGoHome={goHome}
      />
    );
  }

  return <CiviGuideAI onGoApplication={goApplication} />;
}