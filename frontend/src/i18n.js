/**
 * English / हिन्दी strings for the Explore and Guide pages (and the shared nav).
 * Catalogue body text stays in English for now; only service names use `name_hi`.
 *
 *   const { lang, setLang, t } = useLang();
 *   t("docs_progress", { done: 3, total: 9 })  →  "3 of 9 ready"
 */
import { createContext, useContext } from "react";

const STRINGS = {
  en: {
    nav_home: "Home", nav_how: "How It Works", nav_explore: "Explore Services", nav_start: "Start Application", get_started: "Get Started",
    lang_toggle: "हिन्दी", lang_toggle_label: "Switch to Hindi",

    explore_badge: "Guides for Indian government applications",
    explore_title: "What do you need to apply for?",
    explore_sub: "Search certificates, ID cards, licences, agreements, exams, schemes and more. We explain the rules, the steps and what to enter — you fill the official form yourself.",
    search_placeholder: "Try “rent”, “kiraya”, “licence”, “neet”, “caste”…",
    search_label: "Search government services",
    all_categories: "All", filter_any: "Online & offline", filter_online: "Online", filter_offline: "Offline",
    results_count: "{n} services", results_one: "1 service",
    no_results: "No service in our guide matches “{q}”.",
    ask_civiguide: "Ask CiviGuide about “{q}”",
    asking: "Writing a guide…",
    ai_badge: "AI-generated — verify on the official site",
    ai_unavailable: "AI isn't available right now, so here are the closest services in our guide:",
    no_close_match: "No close match either — try different words, or check your state's official portal.",
    open_guide: "Open guide",
    state_specific_badge: "Varies by state",
    online: "Online", offline: "Offline",

    back_to_explore: "All services",
    tab_overview: "Overview", tab_eligible: "Am I eligible?", tab_steps: "Step-by-step", tab_fields: "Fields & what to enter",
    tab_documents: "Documents", tab_rules: "Rules & rejections", tab_ask: "Ask a question",
    authority: "Issued by", official_portal: "Open official portal", no_official_url: "No single national portal — use your state's / the issuing office's official website.",
    fees: "Fees", timeline: "Timeline", photo_specs: "Photo & signature", last_reviewed: "Guide last reviewed {date}",
    state_label: "Your state / UT", choose_state: "Choose your state…", state_notes_title: "How it differs by state",
    eligible_intro: "Tick each statement that is true for you.",
    eligible_yes: "You're eligible ✓", eligible_missing: "{n} still to confirm — check these before applying:",
    steps_progress: "{done} of {total} steps done",
    mark_done: "Mark step {n} done", online_step: "Online", offline_step: "Offline", both_step: "Online or offline",
    required: "Required", optional: "Optional", format: "Format", example: "Example", where_to_find: "Where to find it", common_mistakes: "Common mistakes",
    check_value: "Check my value", check_placeholder: "Type your value to check it", value_ok: "Looks right", copy: "Copy", copied: "Copied",
    private_note: "Checked only in your browser — never sent or saved.",
    id_note: "ID numbers are checked only in your browser and never included in the prep sheet.",
    docs_conditions: "Answer these to tailor your checklist", docs_progress: "{done} of {total} ready", accepted: "Accepted",
    all_ready: "All documents ready!", added_by_condition: "Added because of your answer",
    rules_title: "Key rules", rejections_title: "Common reasons for rejection", tips_title: "Tips",
    legal_note: "General information, not legal advice. For anything unusual, consult a lawyer.",
    ask_intro: "Ask anything about this application — documents, fees, eligibility, mistakes to avoid.",
    ask_placeholder: "e.g. Can I apply without a birth certificate?", ask_send: "Ask",
    ask_offline: "AI isn't available — here's what the guide says:", ask_nothing: "The guide doesn't cover that. Check the official portal or office.",
    ask_error: "Couldn't reach CiviGuide. Please try again.",
    download_prep: "Download my prep sheet", downloading: "Preparing PDF…",
    prep_hint: "A PDF with the official link, steps, every field with your checked values, and your document checklist — to copy from. It is not the official form.",
    prep_error: "Couldn't create the PDF — is the CiviGuide server running?",
    progress_label: "Your progress",
    yes: "Yes", no: "No",
    footer_disclaimer: "CiviGuide gives general guidance. Rules, fees and documents can change and may differ by state — always confirm on the official website or office before applying.",
    not_found: "We couldn't find that guide.",
  },
  hi: {
    nav_home: "होम", nav_how: "यह कैसे काम करता है", nav_explore: "सेवाएँ खोजें", nav_start: "आवेदन शुरू करें", get_started: "शुरू करें",
    lang_toggle: "English", lang_toggle_label: "अंग्रेज़ी में देखें",

    explore_badge: "भारतीय सरकारी आवेदनों की गाइड",
    explore_title: "आपको किसके लिए आवेदन करना है?",
    explore_sub: "प्रमाण पत्र, पहचान पत्र, लाइसेंस, अनुबंध, परीक्षा, योजनाएँ और बहुत कुछ खोजें। हम नियम, चरण और क्या भरना है समझाते हैं — आधिकारिक फ़ॉर्म आप स्वयं भरते हैं।",
    search_placeholder: "जैसे “rent”, “kiraya”, “licence”, “neet”, “जाति”…",
    search_label: "सरकारी सेवाएँ खोजें",
    all_categories: "सभी", filter_any: "ऑनलाइन और ऑफ़लाइन", filter_online: "ऑनलाइन", filter_offline: "ऑफ़लाइन",
    results_count: "{n} सेवाएँ", results_one: "1 सेवा",
    no_results: "हमारी गाइड में “{q}” से मेल खाती कोई सेवा नहीं है।",
    ask_civiguide: "“{q}” के बारे में CiviGuide से पूछें",
    asking: "गाइड लिखी जा रही है…",
    ai_badge: "एआई द्वारा बनाई गई — आधिकारिक साइट पर जाँचें",
    ai_unavailable: "अभी एआई उपलब्ध नहीं है, इसलिए हमारी गाइड की सबसे नज़दीकी सेवाएँ ये हैं:",
    no_close_match: "कोई नज़दीकी मेल भी नहीं मिला — दूसरे शब्द आज़माएँ या अपने राज्य का आधिकारिक पोर्टल देखें।",
    open_guide: "गाइड खोलें",
    state_specific_badge: "राज्य अनुसार अलग",
    online: "ऑनलाइन", offline: "ऑफ़लाइन",

    back_to_explore: "सभी सेवाएँ",
    tab_overview: "सारांश", tab_eligible: "क्या मैं पात्र हूँ?", tab_steps: "चरण-दर-चरण", tab_fields: "फ़ील्ड और क्या भरें",
    tab_documents: "दस्तावेज़", tab_rules: "नियम और अस्वीकृति", tab_ask: "प्रश्न पूछें",
    authority: "जारीकर्ता", official_portal: "आधिकारिक पोर्टल खोलें", no_official_url: "कोई एक राष्ट्रीय पोर्टल नहीं — अपने राज्य / जारी करने वाले कार्यालय की आधिकारिक वेबसाइट देखें।",
    fees: "शुल्क", timeline: "समय", photo_specs: "फ़ोटो और हस्ताक्षर", last_reviewed: "गाइड की अंतिम समीक्षा {date}",
    state_label: "आपका राज्य / केंद्रशासित प्रदेश", choose_state: "अपना राज्य चुनें…", state_notes_title: "राज्यों में अंतर",
    eligible_intro: "जो बातें आप पर लागू होती हैं, उन पर टिक करें।",
    eligible_yes: "आप पात्र हैं ✓", eligible_missing: "{n} बातें अभी पुष्टि बाकी — आवेदन से पहले इन्हें जाँचें:",
    steps_progress: "{total} में से {done} चरण पूरे",
    mark_done: "चरण {n} पूरा करें", online_step: "ऑनलाइन", offline_step: "ऑफ़लाइन", both_step: "ऑनलाइन या ऑफ़लाइन",
    required: "ज़रूरी", optional: "वैकल्पिक", format: "प्रारूप", example: "उदाहरण", where_to_find: "कहाँ मिलेगा", common_mistakes: "आम गलतियाँ",
    check_value: "मेरा मान जाँचें", check_placeholder: "जाँचने के लिए अपना मान लिखें", value_ok: "सही लगता है", copy: "कॉपी", copied: "कॉपी हुआ",
    private_note: "केवल आपके ब्राउज़र में जाँचा जाता है — कहीं भेजा या सहेजा नहीं जाता।",
    id_note: "पहचान संख्याएँ केवल आपके ब्राउज़र में जाँची जाती हैं और तैयारी पत्र में शामिल नहीं होतीं।",
    docs_conditions: "अपनी सूची के लिए इनका उत्तर दें", docs_progress: "{total} में से {done} तैयार", accepted: "मान्य",
    all_ready: "सभी दस्तावेज़ तैयार!", added_by_condition: "आपके उत्तर के कारण जोड़ा गया",
    rules_title: "मुख्य नियम", rejections_title: "अस्वीकृति के आम कारण", tips_title: "सुझाव",
    legal_note: "सामान्य जानकारी, कानूनी सलाह नहीं। असामान्य मामलों में वकील से सलाह लें।",
    ask_intro: "इस आवेदन के बारे में कुछ भी पूछें — दस्तावेज़, शुल्क, पात्रता, गलतियाँ।",
    ask_placeholder: "जैसे: क्या जन्म प्रमाण पत्र के बिना आवेदन कर सकते हैं?", ask_send: "पूछें",
    ask_offline: "एआई उपलब्ध नहीं है — गाइड में यह लिखा है:", ask_nothing: "गाइड में इसका उत्तर नहीं है। आधिकारिक पोर्टल या कार्यालय से पूछें।",
    ask_error: "CiviGuide से संपर्क नहीं हो सका। फिर से कोशिश करें।",
    download_prep: "मेरा तैयारी पत्र डाउनलोड करें", downloading: "PDF बन रहा है…",
    prep_hint: "आधिकारिक लिंक, चरण, आपके जाँचे गए मानों सहित हर फ़ील्ड और दस्तावेज़ सूची वाला PDF — देखकर भरने के लिए। यह आधिकारिक फ़ॉर्म नहीं है।",
    prep_error: "PDF नहीं बन सका — क्या CiviGuide सर्वर चल रहा है?",
    progress_label: "आपकी प्रगति",
    yes: "हाँ", no: "नहीं",
    footer_disclaimer: "CiviGuide सामान्य मार्गदर्शन देता है। नियम, शुल्क और दस्तावेज़ बदल सकते हैं और राज्य अनुसार अलग हो सकते हैं — आवेदन से पहले हमेशा आधिकारिक वेबसाइट या कार्यालय से पुष्टि करें।",
    not_found: "यह गाइड नहीं मिली।",
  },
};

export const LANGS = ["en", "hi"];

/** Translate `key`, filling {placeholders} from `vars`. Falls back to English, then the key. */
export function translate(lang, key, vars = {}) {
  const s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

export const LangContext = createContext({ lang: "en", setLang: () => {} });

/** { lang, setLang, t } for the current language. */
export function useLang() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: (key, vars) => translate(lang, key, vars) };
}

const STORAGE_KEY = "civiguide:lang";

export function loadLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

export function saveLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage unavailable: keep it for this visit only */ }
}
