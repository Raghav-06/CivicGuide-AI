/**
 * Read an online form from a URL (e.g. an exam registration page or its notice PDF) as text
 * the form-analysis engines can use.
 *
 * The server fetches URLs that users type, so it must not become a way into private networks:
 * only http(s) on standard ports, and every connection — including after redirects, and
 * whatever a hostname resolves to at connect time — must go to a public IP address.
 */
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import zlib from "node:zlib";
import * as cheerio from "cheerio";
import { detectFormType, readFormBuffer } from "./formReader.js";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15000;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_URL_LENGTH = 2000;

const withCode = (message, code) => Object.assign(new Error(message), { code });

// ── Public-address check ────────────────────────────────────────────────

const BLOCKED = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) BLOCKED.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["64:ff9b::", 96],
]) BLOCKED.addSubnet(addr, prefix, "ipv6");

/** True for loopback, private, link-local, multicast and other non-public addresses. */
export function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return BLOCKED.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);   // IPv4-mapped IPv6
    return mapped ? BLOCKED.check(mapped[1], "ipv4") : BLOCKED.check(address, "ipv6");
  }
  return true;
}

/** dns.lookup replacement that refuses to connect to non-public addresses. */
function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(withCode("This link points to a private or local network address.", "URL_BLOCKED"));
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/** Parse and vet a user-supplied URL. Throws errors with code URL_INVALID / URL_BLOCKED. */
export function parsePublicUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text || text.length > MAX_URL_LENGTH) throw withCode("Please enter a web address (URL).", "URL_INVALID");
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw withCode("That doesn't look like a web address. It should look like https://example.gov.in/apply.", "URL_INVALID");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw withCode("Only http:// and https:// links are supported.", "URL_INVALID");
  if (url.username || url.password) throw withCode("Links with a username or password in them aren't supported.", "URL_INVALID");
  if (!ALLOWED_PORTS.has(url.port)) throw withCode("Links to non-standard ports aren't supported.", "URL_BLOCKED");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? isPrivateAddress(host) : host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) {
    throw withCode("This link points to a private or local network address.", "URL_BLOCKED");
  }
  url.hash = "";
  return url;
}

// ── Fetching ────────────────────────────────────────────────────────────

/** One GET request (no redirects followed). Resolves { status, headers, body }. */
function getOnce(url, maxBytes) {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, {
      lookup: publicLookup,
      timeout: TIMEOUT_MS,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CiviGuideAI/1.0; +form-reader)",
        Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.6",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return resolve({ status: res.statusCode, headers: res.headers, body: null });
      }
      const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const stream = encoding === "gzip" ? res.pipe(zlib.createGunzip())
        : encoding === "deflate" ? res.pipe(zlib.createInflate())
          : encoding === "br" ? res.pipe(zlib.createBrotliDecompress())
            : res;
      const chunks = [];
      let size = 0;
      stream.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          reject(withCode(`This page is too large to read (over ${Math.round(maxBytes / 1024 / 1024)} MB).`, "URL_TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      stream.on("error", (err) => reject(withCode(`The page couldn't be decoded: ${err.message}`, "URL_FETCH_FAILED")));
    });
    req.on("timeout", () => req.destroy(withCode("The website took too long to respond.", "URL_TIMEOUT")));
    req.on("error", reject);
  });
}

/** Turn low-level network errors into messages a citizen can act on. */
function explainNetworkError(err) {
  if (err.code?.startsWith("URL_")) return err;
  if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return withCode("That website couldn't be found. Check the link for typos.", "URL_FETCH_FAILED");
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(err.code ?? err.message)) {
    return withCode("That website's security certificate couldn't be verified, so it wasn't opened. Save the page as a PDF (Ctrl+P → Save as PDF) and upload that instead.", "URL_FETCH_FAILED");
  }
  if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "EHOSTUNREACH") {
    return withCode("That website refused the connection or is down right now. Try again later.", "URL_FETCH_FAILED");
  }
  return withCode(`The page couldn't be opened: ${err.message}`, "URL_FETCH_FAILED");
}

/**
 * Fetch a public URL, following up to MAX_REDIRECTS redirects (each re-checked).
 * Resolves { url, contentType, body }.
 */
export async function fetchPublicUrl(rawUrl, { maxBytes = MAX_HTML_BYTES } = {}) {
  let url = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await getOnce(url, maxBytes);
    } catch (err) {
      throw explainNetworkError(err);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = parsePublicUrl(new URL(res.headers.location, url).href);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw withCode("This page needs you to log in (or blocks automated access), so it can't be read directly. Open it in your browser, save it as a PDF (Ctrl+P → Save as PDF) and upload that instead.", "URL_FORBIDDEN");
    }
    if (res.status === 404 || res.status === 410) throw withCode("That page doesn't exist (404). Check the link.", "URL_NOT_FOUND");
    if (res.status >= 400) throw withCode(`The website returned an error (${res.status}). Try again later.`, "URL_FETCH_FAILED");
    return { url: url.href, contentType: String(res.headers["content-type"] ?? "").toLowerCase(), body: res.body };
  }
  throw withCode("This link redirects too many times.", "URL_FETCH_FAILED");
}

// ── HTML → form text ────────────────────────────────────────────────────

const SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "image", "reset", "search"]);
const BLOCK_TAGS = "p, div, li, tr, h1, h2, h3, h4, h5, h6, label, legend, fieldset, section, article, form, table, ul, ol, dt, dd, option";

const attr = ($el, name) => ($el.attr(name) ?? "").replace(/\s+/g, " ").trim();

/** Describe a form control as a short marker, e.g. "[input type=email name=email required]". */
function describeControl($, el) {
  const $el = $(el);
  const tag = el.tagName.toLowerCase();
  const type = tag === "input" ? (attr($el, "type") || "text").toLowerCase() : tag;
  if (tag === "input" && SKIP_INPUT_TYPES.has(type)) return "";
  if (/captcha/i.test(`${attr($el, "name")} ${attr($el, "id")}`)) return "";

  const parts = [tag === "input" ? `input type=${type}` : tag];
  const name = attr($el, "name") || attr($el, "id");
  if (name) parts.push(`name=${name}`);
  for (const a of ["placeholder", "aria-label", "title", "pattern", "maxlength", "min", "max"]) {
    const v = attr($el, a);
    if (v) parts.push(`${a}="${v.slice(0, 80)}"`);
  }
  if ((type === "radio" || type === "checkbox") && attr($el, "value")) parts.push(`value="${attr($el, "value").slice(0, 80)}"`);
  if ($el.is("[required]") || attr($el, "aria-required") === "true") parts.push("required");
  if (tag === "select") {
    const options = $el.find("option").toArray()
      .map((o) => $(o).text().replace(/\s+/g, " ").trim())
      .filter((t) => t && !/^(--+.*|select.*|choose.*|please select.*)$/i.test(t));
    if (options.length) parts.push(`options: ${options.slice(0, 40).join(" | ")}${options.length > 40 ? " | …" : ""}`);
  }
  return ` [${parts.join(" ")}] `;
}

/**
 * Extract readable text from an HTML page, with each form control replaced by a marker
 * describing it. Returns { title, text }.
 */
export function htmlToFormText(html) {
  const $ = cheerio.load(html);
  const title = $("title").first().text().replace(/\s+/g, " ").trim()
    || $("h1").first().text().replace(/\s+/g, " ").trim();

  $("script, style, noscript, svg, iframe, template, head, nav, footer, header[role=banner]").remove();

  $("input, select, textarea").each((_, el) => { $(el).replaceWith(describeControl($, el)); });
  $("br").replaceWith("\n");
  $(BLOCK_TAGS).each((_, el) => { $(el).append("\n"); });

  // With a real form on the page, its contents are what matter; otherwise use the whole page.
  const forms = $("form").toArray().filter((f) => /\[(input|select|textarea)/.test($(f).text()));
  const root = forms.length ? forms.map((f) => $(f)) : [$("body").length ? $("body") : $.root()];

  const text = root.map(($r) => $r.text()).join("\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title, text };
}

/**
 * Read an online form: fetch the URL, then extract text from the HTML page, PDF or DOCX.
 * Resolves { url, title, text, kind } where `kind` is "html" or "document".
 * Errors carry a `code` starting with URL_ (or the PDF/DOCX codes from formReader).
 */
export async function readFormFromUrl(rawUrl, { maxBytes } = {}) {
  const { url, contentType, body } = await fetchPublicUrl(rawUrl, { maxBytes });
  const lastSegment = new URL(url).pathname.split("/").pop() || "";
  let filename;
  try {
    filename = decodeURIComponent(lastSegment);
  } catch {
    filename = lastSegment;
  }

  const docType = detectFormType(body, filename, contentType.split(";")[0].trim());
  if (docType && !contentType.includes("html")) {
    const text = await readFormBuffer(body, filename || `form.${docType}`, contentType.split(";")[0].trim());
    return { url, title: filename.replace(/\.(pdf|docx)$/i, "") || new URL(url).hostname, text, kind: "document" };
  }

  if (contentType && !/html|xml|text\/plain/.test(contentType)) {
    throw withCode("This link isn't a web page, PDF or Word document, so it can't be read.", "URL_UNSUPPORTED");
  }
  const raw = body.toString("utf8");
  if (contentType.includes("text/plain")) return { url, title: new URL(url).hostname, text: raw.trim(), kind: "html" };

  const { title, text } = htmlToFormText(raw);
  return { url, title: title || new URL(url).hostname, text, kind: "html" };
}
