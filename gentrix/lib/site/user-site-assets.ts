/**
 * Optionele eigen CSS/JS per site (editor + export + publicatie).
 *
 * - **Geen** DOMPurify op JavaScript: dat maakt code niet “veilig”, alleen HTML.
 * - **CSS:** strippen van gevaarlijke patronen + breken van `</style`-sequences.
 * - **JS in HTML-string** (iframe srcdoc, export index.html): base64-bootstrap om `</script>`-breakout te voorkomen.
 * - **JS op gepubliceerde pagina:** `new Function` via `JSON.stringify` (geen HTML-parser ertussen).
 *
 * Preview-iframe: `sandbox` zonder `allow-same-origin` → geïsoleerde origin.
 * Live site: JS draait same-origin met je domein — alleen vertrouwde code.
 */

export const USER_SITE_CSS_MAX = 48_000;
export const USER_SITE_JS_MAX = 48_000;

export function truncateUserAsset(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/** Werkt in Node (SSR/export) en browser (preview). */
export function utf8ToBase64(s: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/**
 * CSS voor in `<style>`: voorkomt HTML-parser breakout en verkleint klassieke CSS-XSS-vectoren.
 */
export function sanitizeUserSiteCss(input: string): string {
  let s = truncateUserAsset(input, USER_SITE_CSS_MAX);
  s = s.replace(/<\/style/gi, "\\3c/style");
  s = s.replace(/@import\b[\s\S]*?;/gi, "/* @import verwijderd */");
  s = s.replace(/@import\b[\s\S]*$/gi, "/* @import verwijderd */");
  s = s.replace(/expression\s*\(/gi, "blocked(");
  s = s.replace(/javascript\s*:/gi, "blocked:");
  s = s.replace(/-moz-binding\s*:/gi, "blocked:");
  s = s.replace(/behavior\s*:/gi, "blocked:");
  return s;
}

export function prepareUserSiteJs(input: string): string {
  return truncateUserAsset(input.trim(), USER_SITE_JS_MAX);
}

/**
 * `<script>…</script>` voor srcdoc / statische HTML: geen ruwe user-string in HTML.
 */
export function buildUserScriptTagForHtmlDocument(userJs: string): string {
  const src = prepareUserSiteJs(userJs);
  if (!src) return "";
  const b64 = utf8ToBase64(src);
  return `<script>(function(){try{var u=atob(${JSON.stringify(b64)});(new Function(u))();}catch(e){console.error("[Studio user JS]",e);try{if(window.parent!==window)window.parent.postMessage({source:"studio-user-js",type:"error",message:String(e&&e.message||e)},"*");}catch(x){}}try{if(typeof performance!=="undefined")performance.mark("studio-user-js-done");}catch(_){}})();<\/script>`;
}

/**
 * Bron voor `HTMLScriptElement.textContent` (geen HTML-parse van user code).
 */
export function buildUserScriptSourceForDom(userJs: string): string {
  const body = prepareUserSiteJs(userJs);
  if (!body) return "";
  return `try{(new Function(${JSON.stringify(body)}))();}catch(e){console.error("[Studio user JS]",e);}if(typeof performance!=="undefined")try{performance.mark("studio-user-js-done");}catch(_){}`;
}
