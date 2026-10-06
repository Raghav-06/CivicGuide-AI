/**
 * Per-answer validation shared by the backend (Engines 2–4) and the frontend (offline mode),
 * so an answer is checked the moment it is given — not only when the whole form is reviewed.
 *
 *   checkAnswer(field, value) → { value, error }
 *
 * `value` is the answer in its cleaned-up form (e.g. "+91 98765-43210" → "9876543210",
 * PAN in capitals); `error` is a message for the user, or null when the answer is acceptable.
 * Empty answers are not checked here — whether a field is required is decided elsewhere.
 *
 * What a field holds is worked out from its type, then from its name and label, so
 * "Aadhaar Number" typed as plain text still gets the Aadhaar rules.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MAX_AGE_YEARS = 120;

// Verhoeff checksum tables (Aadhaar numbers end in a Verhoeff check digit).
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits) {
  let c = 0;
  [...String(digits)].reverse().forEach((ch, i) => { c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(ch)]]; });
  return c === 0;
}

/** Field name + label as lower-case words ("fathers_full_name" → "fathers full name"). */
function describe(field) {
  return `${field?.field ?? ""} ${field?.label ?? ""}`.replace(/[_\-/]+/g, " ").toLowerCase();
}

// Names of things that aren't a person's name, even though the label says "name".
const NOT_A_PERSON = /\b(business|employer|company|firm|organi[sz]ation|institut\w*|school|college|university|hospital|bank|branch|office|registrar|village|town|city|district|state|place|street|road|locality|building|exam|course|post|scheme|centre|center|shop|board)\b/;

/** What kind of value this field holds, by type first, then by its name/label. */
export function fieldKind(field) {
  const text = describe(field);
  const type = field?.type;

  if (type === "email" || /\be ?mail\b/.test(text)) return "email";
  if (type === "url" || /\b(url|website|web site|web address)\b/.test(text)) return "url";
  if (type === "date") return /\b(birth|dob)\b/.test(text) ? "birth_date" : "date";
  if (/\bdate of birth\b|\bdob\b/.test(text)) return "birth_date";
  if (type === "select" || type === "boolean") return type;
  // "Name as on Aadhaar" is a name, "Aadhaar Number" is an ID.
  const isId = !/\bname\b/.test(text) || /\b(number|no|num)\b/.test(text);
  if (isId && /\baadhaa?r\b|\buid\b/.test(text)) return /\bvoter\b|\bepic\b/.test(text) ? "aadhaar_or_voter" : "aadhaar";
  if (isId && /\bvoter\b|\bepic\b/.test(text)) return "voter_id";
  if (isId && /\bpan\b|permanent account/.test(text)) return "pan";
  if (isId && /\bifsc\b/.test(text)) return "ifsc";
  // "Address (with PIN)" is an address, not a PIN code.
  if (/\baddress\b/.test(text)) return type === "number" || type === "phone" ? type : "text";
  if (isId && /\bpin ?code\b|\bpin\b|\bpostal code\b|\bzip\b/.test(text)) return "pin";
  if (type === "phone" || /\b(mobile|phone|telephone|whatsapp)\b/.test(text)) return "phone";
  if (type === "number") return "number";
  if (/\bname\b/.test(text) && !NOT_A_PERSON.test(text)) return "person_name";
  return "text";
}

/** Parse a date in DD/MM/YYYY, D-M-YYYY, DD.MM.YYYY, YYYY-MM-DD or "15 Aug 1990" form → { d, m, y } or null. */
export function parseDate(value) {
  const s = String(value ?? "").trim();
  let d, m, y, match;
  if ((match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    [, y, m, d] = match;
  } else if ((match = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/))) {
    [, d, m, y] = match;
  } else if ((match = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,})\.?,?[\s-]+(\d{4})$/i))) {
    d = match[1];
    m = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    y = match[3];
  } else if ((match = s.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i))) {
    m = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
    d = match[2];
    y = match[3];
  } else {
    return null;
  }
  [d, m, y] = [Number(d), Number(m), Number(y)];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!m || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { d, m, y };
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Indian mobile numbers lose spaces, dashes and a +91 / 0091 / 91 / 0 prefix. */
function cleanPhone(value) {
  let s = String(value).replace(/[\s\-().]/g, "");
  if (/^\+91\d{10}$/.test(s)) s = s.slice(3);
  else if (/^0091\d{10}$/.test(s)) s = s.slice(4);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  else if (/^0\d{10}$/.test(s)) s = s.slice(1);
  return s;
}

const ok = (value) => ({ value, error: null });
const bad = (value, error) => ({ value, error });

/** Check one answer against the rules for its field. See the module comment. */
export function checkAnswer(field, value) {
  if (value === null || value === undefined || String(value).trim() === "") return ok(value);
  const label = field?.label || String(field?.field ?? "this field").replace(/_/g, " ");
  const str = String(value).trim();
  const compact = str.replace(/[\s-]/g, "");

  switch (fieldKind(field)) {
    case "email": {
      const email = str.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && !email.includes("..")
        ? ok(email)
        : bad(str, `"${str}" isn't a valid email address. It should look like name@example.com.`);
    }

    case "url": {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(str) ? str : `https://${str}`;
      try {
        const url = new URL(withScheme);
        if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".")) return ok(url.href);
      } catch { /* reported below */ }
      return bad(str, `"${str}" isn't a valid web address. It should look like https://example.gov.in.`);
    }

    case "date":
    case "birth_date": {
      const p = parseDate(str);
      if (!p) return bad(str, `"${str}" isn't a valid date. Please use DD/MM/YYYY, e.g. 15/08/1990.`);
      const formatted = `${pad2(p.d)}/${pad2(p.m)}/${p.y}`;
      const date = Date.UTC(p.y, p.m - 1, p.d);
      const now = new Date();
      const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      if (fieldKind(field) === "birth_date") {
        if (date > today) return bad(formatted, `A date of birth can't be in the future (${formatted}).`);
        if (p.y < now.getFullYear() - MAX_AGE_YEARS) return bad(formatted, `${formatted} would make the age over ${MAX_AGE_YEARS} years — please check the year.`);
      } else if (p.y < now.getFullYear() - 150 || p.y > now.getFullYear() + 50) {
        return bad(formatted, `The year in ${formatted} looks wrong — please check it.`);
      }
      return ok(formatted);
    }

    case "select": {
      const options = Array.isArray(field.options) ? field.options : [];
      if (!options.length) return ok(str);
      const find = (s) => options.find((o) => String(o).trim().toLowerCase() === s.trim().toLowerCase());
      const match = find(str);
      if (match !== undefined) return ok(match);
      // Fields that allow several choices take "a, b and c".
      if (field.multiple === true) {
        const parts = str.split(/\s*(?:,|;|&|\band\b)\s*/i).filter(Boolean);
        const matches = parts.map(find);
        if (parts.length && matches.every((m) => m !== undefined)) return ok([...new Set(matches)].join(", "));
        return bad(str, `Choose from: ${options.join(", ")} (you can pick more than one, separated by commas).`);
      }
      return bad(str, `"${str}" isn't one of the options. Choose one of: ${options.join(", ")}.`);
    }

    case "boolean": {
      if (value === true || /^(y|yes|true|haan|ha)\b/i.test(str)) return ok("Yes");
      if (value === false || /^(n|no|false|nahi|nope|never)\b/i.test(str)) return ok("No");
      return bad(str, `Please answer Yes or No for ${label}.`);
    }

    case "aadhaar":
    case "aadhaar_or_voter": {
      if (/^\d{12}$/.test(compact)) {
        if (/^[01]/.test(compact)) return bad(str, "An Aadhaar number never starts with 0 or 1 — please check it.");
        if (!verhoeffValid(compact)) return bad(str, "That Aadhaar number isn't valid (its check digit doesn't match) — please check for a typo.");
        return ok(compact.replace(/(\d{4})(?=\d)/g, "$1 "));
      }
      if (fieldKind(field) === "aadhaar_or_voter" && /^[A-Z]{3}\d{7}$/i.test(compact)) return ok(compact.toUpperCase());
      return bad(str, fieldKind(field) === "aadhaar"
        ? "An Aadhaar number has exactly 12 digits, e.g. 2345 6789 0123."
        : "Enter a 12-digit Aadhaar number or a Voter ID like ABC1234567.");
    }

    case "voter_id":
      return /^[A-Z]{3}\d{7}$/i.test(compact)
        ? ok(compact.toUpperCase())
        : bad(str, "A Voter ID (EPIC) number is 3 letters followed by 7 digits, e.g. ABC1234567.");

    case "pan":
      return /^[A-Z]{5}\d{4}[A-Z]$/i.test(compact)
        ? ok(compact.toUpperCase())
        : bad(str, "A PAN has 10 characters: 5 letters, 4 digits, then a letter, e.g. ABCDE1234F.");

    case "ifsc":
      return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(compact)
        ? ok(compact.toUpperCase())
        : bad(str, "An IFSC code has 11 characters: 4 letters, a zero, then 6 letters or digits, e.g. SBIN0001234.");

    case "pin":
      return /^[1-9]\d{5}$/.test(compact)
        ? ok(compact)
        : bad(str, "A PIN code has exactly 6 digits and doesn't start with 0, e.g. 110001.");

    case "phone": {
      const phone = cleanPhone(str);
      if (/^[6-9]\d{9}$/.test(phone)) return ok(phone);
      // A number with another country code: accept any plausible international number.
      if (/^\+(?!91)\d{7,15}$/.test(phone)) return ok(phone);
      return bad(str, /^\d{10}$/.test(phone)
        ? "Indian mobile numbers start with 6, 7, 8 or 9 — please check the number."
        : "A mobile number has 10 digits, e.g. 9876543210 (add the country code, like +1…, if it isn't Indian).");
    }

    case "number": {
      const digits = str.replace(/[₹,\s]|rs\.?|inr/gi, "");
      const n = typeof value === "number" ? value : digits === "" ? NaN : Number(digits);
      if (!Number.isFinite(n)) return bad(str, `${label} must be a number, e.g. 25000.`);
      if (n < 0) return bad(n, `${label} can't be negative.`);
      if (/\bage\b/.test(describe(field)) && n > MAX_AGE_YEARS) return bad(n, `An age of ${n} isn't possible — please check it.`);
      if (/\b(years?|duration)\b/.test(describe(field)) && n > MAX_AGE_YEARS) return bad(n, `${n} years looks too long — please check it.`);
      return ok(n);
    }

    case "person_name":
      if (/\d/.test(str)) return bad(str, `A name shouldn't contain digits — please check ${label}.`);
      if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(str) || str.replace(/[^\p{L}]/gu, "").length < 2) {
        return bad(str, `Please enter ${label} using letters only (spaces, dots and hyphens are fine).`);
      }
      return ok(str.replace(/\s+/g, " "));

    default:
      return ok(typeof value === "string" ? str : value);
  }
}
