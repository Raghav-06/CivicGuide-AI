import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SERVICES, CATEGORY_IDS, FIELD_TYPES, getService, searchServices, isOfficialUrl, checklistFor, highlightParts, findInService,
} from "./index.js";
import { checkAnswer } from "../answerRules.js";

const REQUIRED_KEYS = [
  "id", "name", "name_hi", "category", "keywords", "authority", "official_url", "modes", "state_specific", "summary",
  "eligibility", "steps", "fields", "documents", "conditions", "fees", "timeline", "photo_signature_specs", "rules",
  "rejection_reasons", "tips", "last_reviewed",
];

test("the catalogue has at least 25 services covering every category", () => {
  assert.ok(SERVICES.length >= 25, `only ${SERVICES.length} services`);
  for (const id of CATEGORY_IDS) assert.ok(SERVICES.some((s) => s.category === id), `no service in ${id}`);
});

test("ids are unique", () => {
  const ids = SERVICES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const s of SERVICES) {
  test(`${s.id}: entry is complete and well-formed`, () => {
    for (const key of REQUIRED_KEYS) assert.ok(key in s, `missing "${key}"`);
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(CATEGORY_IDS.includes(s.category), `unknown category ${s.category}`);
    assert.ok(/[ऀ-ॿ]/.test(s.name_hi), "name_hi should be in Devanagari");
    assert.ok(s.modes.length && s.modes.every((m) => m === "online" || m === "offline"));
    assert.ok(Array.isArray(s.keywords) && s.keywords.length);
    if (s.state_specific) assert.ok(typeof s.state_notes === "string" && s.state_notes.length > 20, "state_specific needs state_notes");
    assert.match(s.fees, /^Indicative only/);
    assert.match(s.timeline, /^Indicative only/);
    assert.match(s.last_reviewed, /^\d{4}-\d{2}$/);
    for (const step of s.steps) {
      assert.ok(step.title && step.detail, "step needs title and detail");
      assert.ok(["online", "offline", "both"].includes(step.mode), `step mode ${step.mode}`);
    }
  });

  test(`${s.id}: fields use allowed types and pass their own examples`, () => {
    const names = new Set();
    for (const f of s.fields) {
      assert.ok(FIELD_TYPES.includes(f.type), `${f.field}: type "${f.type}" not allowed`);
      assert.match(f.field, /^[a-z0-9_]+$/);
      assert.ok(!names.has(f.field), `duplicate field ${f.field}`);
      names.add(f.field);
      assert.equal(typeof f.required, "boolean");
      if (f.type === "select") assert.ok(f.options?.length, `${f.field}: select needs options`);
      // Examples must be accepted by the checker, or "Check my value" would contradict the guide.
      if (f.example) assert.equal(checkAnswer(f, f.example).error, null, `${f.field}: example "${f.example}" fails its own check`);
    }
  });

  test(`${s.id}: official_url is null or an https government site`, () => {
    assert.ok(s.official_url === null || isOfficialUrl(s.official_url), `bad official_url ${s.official_url}`);
  });

  test(`${s.id}: documents and conditions line up`, () => {
    for (const d of s.documents) {
      assert.ok(d.name && typeof d.mandatory === "boolean");
      assert.ok(d.condition === null || d.condition === undefined || typeof d.condition === "string");
    }
    for (const c of s.conditions) {
      assert.ok(c.id && c.question && Array.isArray(c.adds_documents) && c.adds_documents.length);
      const on = checklistFor(s, [c.id]).map((d) => d.name);
      for (const name of c.adds_documents) assert.ok(on.includes(name), `${c.id} should add ${name}`);
    }
  });

  if (["property-agreements", "affidavits"].includes(s.category)) {
    test(`${s.id}: carries the legal note`, () => {
      assert.equal(s.legal_note, true);
      assert.ok(s.rules.some((r) => /not legal advice/i.test(r)));
    });
  }
}

test("isOfficialUrl accepts government hosts only", () => {
  assert.ok(isOfficialUrl("https://www.passportindia.gov.in/"));
  assert.ok(isOfficialUrl("https://neet.nta.nic.in/"));
  assert.ok(isOfficialUrl("https://www.usa.gov/"));
  assert.ok(!isOfficialUrl("http://www.passportindia.gov.in/"));
  assert.ok(!isOfficialUrl("https://gov.in.example.com/"));
  assert.ok(!isOfficialUrl("https://passport-seva-online.com/"));
  assert.ok(!isOfficialUrl(null));
});

const top = (q) => searchServices(q)[0]?.service.id;

test("search finds services by name, Hindi/Hinglish words and keywords", () => {
  assert.equal(top("rent"), "rent-agreement");
  assert.equal(top("kiraya"), "rent-agreement");
  assert.equal(top("किराया"), "rent-agreement");
  assert.equal(top("caste"), "caste-certificate");
  assert.equal(top("neet"), "entrance-exam-nta");
  assert.equal(top("licence"), "driving-licence");
  assert.equal(top("driving license"), "driving-licence");
  assert.equal(top("aadhar update"), "aadhaar-update");
  assert.equal(top("passport tatkal"), "passport-fresh");
  assert.deepEqual(searchServices("zzzz nothing"), []);
  assert.deepEqual(searchServices("   "), []);
});

test("checklistFor adds conditional documents only when the condition is on", () => {
  const passport = getService("passport-fresh");
  const base = checklistFor(passport).map((d) => d.name);
  assert.ok(!base.includes("Parents' passports / Annexure D"));
  assert.ok(checklistFor(passport, ["minor"]).some((d) => d.name === "Parents' passports / Annexure D"));
  assert.equal(getService("nope"), null);
});

test("highlightParts marks matched words", () => {
  const parts = highlightParts("Rent / Leave-and-Licence Agreement", "rent lic");
  assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ["Rent", "Lic"]);
});

test("findInService returns relevant catalogue lines", () => {
  const lines = findInService(getService("rent-agreement"), "does it need registration?");
  assert.ok(lines.length && lines.some((l) => /regist/i.test(l)));
});
