"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, ExternalLink, ImagePlus, Loader2, Paintbrush, Rocket, Save } from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildTailwindIframeSrcDoc } from "@/components/site/tailwind-sections-preview";
import { resolveNavHrefToPageId } from "@/lib/portal/portal-editor-nav-href";
import { buildPortalThemePresets, type PortalThemePreset } from "@/lib/portal/portal-theme-presets";

type ThemePresetId = PortalThemePreset["id"];

type RestyleResponsePayload = {
  config: TailwindPageConfig;
  sections: TailwindSection[];
  contactSections?: TailwindSection[];
  marketingPages?: Record<string, TailwindSection[]>;
};

type EditableSection = {
  key: string;
  sectionName: string;
  section: TailwindSection;
};

export type PortalEditorPage = {
  id: string;
  label: string;
  sections: EditableSection[];
};

type SnapshotSection = {
  key: string;
  html: string;
};

type ScanStats = {
  sections: number;
  text: number;
  images: number;
};

type Props = {
  slug: string;
  clientName: string;
  documentTitle: string;
  pages: PortalEditorPage[];
  pageConfig?: TailwindPageConfig | null;
  /**
   * De originele (pre-thema) pageConfig uit `clients.theme_variants.original.config`.
   * Wordt gebruikt om de thema-swatches (Donker/Warm) af te leiden uit het onveranderde palet
   * i.p.v. uit de huidige — mogelijk al getransformeerde — draft-config. Zonder dit zouden de
   * swatches na een eerdere restyle compound raken (Warm-van-warm, Dark-van-warm, ...).
   */
  originalPageConfig?: TailwindPageConfig | null;
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  compiledTailwindCss?: string | null;
  /** Publieke URL voor de "Open site" link en terugkoppeling na publiceren. */
  publicSiteUrl?: string | null;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapSectionHtml(html: string, key: string, sectionName: string): string {
  return `<div data-portal-section-key="${escapeAttr(key)}" data-portal-section-name="${escapeAttr(sectionName)}">${html}</div>`;
}

function buildPortalEditorCss(): string {
  return `
[data-portal-section-key] {
  display: contents !important;
}

[data-portal-editable="text"],
[data-portal-editable="image"] {
  cursor: pointer;
  transition: outline-color 120ms ease, background-color 120ms ease;
}

[data-portal-editable="text"] {
  position: relative;
  outline: 1px dashed rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

[data-portal-editable="text"]:hover {
  outline: 2px solid rgba(37, 99, 235, 0.65);
  outline-offset: 2px;
  background: rgba(219, 234, 254, 0.35);
}

[data-portal-editable="image"] {
  outline: 1px dashed rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

[data-portal-editable="image"]:hover {
  outline: 2px solid rgba(37, 99, 235, 0.65);
  outline-offset: 2px;
  cursor: pointer;
}

[contenteditable="true"][data-portal-editable="text"] {
  outline: 2px solid rgba(16, 185, 129, 0.9) !important;
  outline-offset: 3px !important;
  background: rgba(236, 253, 245, 0.85) !important;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Voorkom dat Alpine x-cloak / x-show conflicteert tijdens edit */
[contenteditable="true"] * { pointer-events: none; }

/* Voorkom dat overlay-divs en animatie-wrappers editor-clicks blokkeren */
[data-animation] { pointer-events: none !important; }
div.absolute.inset-0:not([data-portal-editable]) { pointer-events: none !important; }

/* Zorg dat editable elementen altijd klikbaar zijn, ook als een parent pointer-events: none heeft */
[data-portal-editable] { pointer-events: auto !important; }
`;
}

function injectPortalEditorIntoSrcDoc(doc: string): string {
  const styleTag = `<style id="portal-visual-editor-css">${buildPortalEditorCss()}</style>`;
  const markScript = `<script>
(function(){
  function fixOverlayPointerEvents(){
    document.querySelectorAll('[data-animation]').forEach(function(el){
      el.style.pointerEvents='none';
    });
    document.querySelectorAll('div.absolute.inset-0').forEach(function(el){
      if(!el.getAttribute('data-portal-editable')) el.style.pointerEvents='none';
    });
  }
  function mark(){
    var sections = document.querySelectorAll('[data-portal-section-key]');
    if(!sections.length) return 0;
    fixOverlayPointerEvents();
    var ti=0, ii=0;
    sections.forEach(function(section){
      section.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption').forEach(function(el){
        if(el.closest('nav,header,footer,a,button')) return;
        if(el.getAttribute('contenteditable')==='true') return;
        var text=(el.textContent||'').replace(/\\s+/g,' ').trim();
        if(!text) return;
        el.setAttribute('data-portal-editable','text');
        el.setAttribute('data-portal-text-id','text-'+ti++);
      });
      section.querySelectorAll('img').forEach(function(img){
        if(img.closest('a,button,nav,header')) return;
        img.setAttribute('data-portal-editable','image');
        img.setAttribute('data-portal-image-id','image-'+ii++);
      });
    });
    return ti;
  }
  function tryMark(attempts){
    var n=mark();
    if(n===0 && attempts<20) setTimeout(function(){tryMark(attempts+1);},200);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){tryMark(0);});
  } else {
    tryMark(0);
  }
  window.addEventListener('load',function(){tryMark(0);});
})();
<\/script>`;
  const withStyle = doc.includes("</head>") ? doc.replace("</head>", `${styleTag}</head>`) : `${styleTag}${doc}`;
  return withStyle.includes("</body>") ? withStyle.replace("</body>", `${markScript}</body>`) : `${withStyle}${markScript}`;
}

export function PortalVisualSiteEditor({
  slug,
  clientName,
  documentTitle,
  pages,
  pageConfig,
  originalPageConfig,
  userCss,
  userJs,
  logoSet,
  compiledTailwindCss,
  publicSiteUrl,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeCleanupRef = useRef<(() => void) | null>(null);
  // Swatch-baseline: voorkeur voor de server-side opgeslagen originele pageConfig (uit
  // `clients.theme_variants.original.config`). Pas wanneer er nog geen cache-entry is (klant heeft
  // nog nooit een thema toegepast), vallen we terug op de huidige `pageConfig` ? die is dan per
  // definitie ook de originele.
  const basePageConfigRef = useRef<TailwindPageConfig | null>(
    originalPageConfig ?? pageConfig ?? null,
  );
  // Ref zodat bindIframeEditor altijd de laatste onSelectPage aanroept zonder circulaire deps
  const onSelectPageRef = useRef<((pageId: string) => Promise<void>) | null>(null);

  const [titleValue, setTitleValue] = useState(documentTitle);
  const [savedTitleValue, setSavedTitleValue] = useState(documentTitle);
  const [pageConfigValue, setPageConfigValue] = useState<TailwindPageConfig | null>(pageConfig ?? null);
  const [savedPageConfigValue, setSavedPageConfigValue] = useState<TailwindPageConfig | null>(pageConfig ?? null);
  const [pageStates, setPageStates] = useState<Record<string, EditableSection[]>>(() =>
    Object.fromEntries(pages.map((page) => [page.id, page.sections])),
  );
  const [selectedPageId, setSelectedPageId] = useState<string>(pages[0]?.id ?? "main");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [switchingPage, setSwitchingPage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [pendingImageTarget, setPendingImageTarget] = useState<{
    imageId: string;
    sectionKey: string;
    src: string;
    alt: string;
  } | null>(null);
  const [restylingThemeId, setRestylingThemeId] = useState<ThemePresetId | null>(null);

  const enc = encodeURIComponent(decodeURIComponent(slug));
  const currentPage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;
  // Memoized zodat de referentie stabiel is; een losse expressie maakt anders elke render een
  // nieuw array, waardoor `srcDoc` wijzigt en de iframe continu herlaadt.
  const currentSections = useMemo(() => {
    return currentPage ? pageStates[currentPage.id] ?? currentPage.sections : [];
  }, [currentPage, pageStates]);
  const themePresets = useMemo(() => buildPortalThemePresets(basePageConfigRef.current), []);
  const activePresetId = useMemo(() => {
    const current = JSON.stringify(pageConfigValue ?? null);
    const preset = themePresets.find((item) => JSON.stringify(item.pageConfig) === current);
    return preset?.id ?? null;
  }, [pageConfigValue, themePresets]);

  const previewSections = useMemo(
    () =>
      currentSections.map(({ key, sectionName, section }) => ({
        ...section,
        html: wrapSectionHtml(section.html, key, sectionName),
      })),
    [currentSections],
  );

  const srcDoc = useMemo(() => {
    const base = buildTailwindIframeSrcDoc(previewSections, pageConfigValue, {
      previewPostMessageBridge: false,
      disableScrollRevealAnimations: true,
      userCss,
      userJs: undefined,
      logoSet,
      publishedSlug: decodeURIComponent(slug),
      compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
      navBrandLabel: clientName,
    });
    return injectPortalEditorIntoSrcDoc(base);
  }, [clientName, compiledTailwindCss, logoSet, pageConfigValue, previewSections, slug, userCss, userJs]);

  const mergeSnapshotIntoSections = useCallback((baseSections: EditableSection[], snapshot: SnapshotSection[]) => {
    const htmlByKey = new Map(snapshot.map((item) => [item.key, item.html]));
    return baseSections.map((item) =>
      htmlByKey.has(item.key)
        ? { ...item, section: { ...item.section, html: htmlByKey.get(item.key) ?? item.section.html } }
        : item,
    );
  }, []);

  const isTextCandidate = useCallback((el: Element) => {
    if (typeof (el as HTMLElement).matches !== "function") return false;
    if (!el.matches("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption")) return false;
    if (el.closest("nav,footer,a,button,[role='navigation']")) return false;
    if (el.closest("header[x-data]")) return false;  // Alpine navbar — niet aanraken
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return text.length > 0;
  }, []);

  const markIframeEditables = useCallback(
    (doc: Document) => {
      let sectionCount = 0;
      let textIndex = 0;
      let imageIndex = 0;
      for (const section of Array.from(doc.querySelectorAll("[data-portal-section-key]"))) {
        sectionCount += 1;
        for (const node of Array.from(section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption"))) {
          if (!isTextCandidate(node)) continue;
          const el = node as HTMLElement;
          if (el.getAttribute("contenteditable") === "true") continue;
          el.setAttribute("data-portal-editable", "text");
          el.setAttribute("data-portal-text-id", `text-${textIndex++}`);
        }
        for (const node of Array.from(section.querySelectorAll("img"))) {
          const img = node as HTMLImageElement;
          if (img.closest("a,button,nav,header,[role='navigation']")) continue;
          img.setAttribute("data-portal-editable", "image");
          img.setAttribute("data-portal-image-id", `image-${imageIndex++}`);
        }
      }
      setScanStats({ sections: sectionCount, text: textIndex, images: imageIndex });
      return { sections: sectionCount, text: textIndex, images: imageIndex };
    },
    [isTextCandidate],
  );

  const extractSnapshotFromDocument = useCallback((doc: Document) => {
    // Verwijder editor-overlays zodat die niet mee in de snapshot komen
    doc.querySelectorAll("[data-portal-confirm-btn],[data-portal-camera-btn]").forEach((n) => n.remove());
    const sections: SnapshotSection[] = [];
    for (const sectionNode of Array.from(doc.querySelectorAll("[data-portal-section-key]"))) {
      const clone = (sectionNode as HTMLElement).cloneNode(true) as HTMLElement;
      // Sla structurele secties (navbar/footer/nav) over — die zijn niet bewerkbaar en mogen de
      // sanitizer-reparaties niet doorlopen, anders raakt de Alpine-wiring van de originele nav kapot.
      const firstEl = clone.firstElementChild;
      if (firstEl && /^(header|footer|nav)$/i.test(firstEl.tagName)) continue;
      for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
        if ((node as Element).nodeType !== 1) continue;
        for (const attr of Array.from((node as Element).attributes)) {
          if (/^data-portal-/.test(attr.name)) node.removeAttribute(attr.name);
        }
        node.removeAttribute("contenteditable");
        node.removeAttribute("style");
      }
      sections.push({
        key: sectionNode.getAttribute("data-portal-section-key") ?? "",
        html: clone.innerHTML,
      });
    }
    return sections;
  }, []);

  /** Activeer inline tekst-bewerking op een element in de iframe. */
  const activateInlineEdit = useCallback((doc: Document, el: HTMLElement) => {
    // Stop eventuele andere inline-edit sessie inclusief editor-overlays
    doc.querySelectorAll('[data-portal-confirm-btn],[data-portal-camera-btn]').forEach((n) => n.remove());
    doc.querySelectorAll('[contenteditable="true"]').forEach((node) => {
      if (node !== el) {
        (node as HTMLElement).contentEditable = "false";
        node.removeAttribute("contenteditable");
      }
    });

    const originalText = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    el.contentEditable = "true";

    // Cursor helemaal achteraan plaatsen
    try {
      const range = doc.createRange();
      const sel = doc.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* ignore */
    }

    // ── Zwevende confirm-knop (bolletje met vinkje) ──
    const confirmBtn = doc.createElement("button");
    confirmBtn.setAttribute("data-portal-confirm-btn", "1");
    confirmBtn.setAttribute("aria-label", "Bevestig wijziging");
    confirmBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    confirmBtn.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "width:44px",
      "height:44px",
      "border-radius:50%",
      "background:#10b981",
      "color:#fff",
      "border:none",
      "cursor:pointer",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "box-shadow:0 2px 12px rgba(0,0,0,0.22)",
      "transition:transform 120ms ease,background 120ms ease",
      "touch-action:manipulation",
      "-webkit-tap-highlight-color:transparent",
    ].join(";");

    const positionBtn = () => {
      const rect = el.getBoundingClientRect();
      const top = Math.max(8, rect.bottom + 8);
      const left = Math.min(
        (doc.documentElement.clientWidth || 800) - 52,
        Math.max(8, rect.right - 44),
      );
      confirmBtn.style.top = `${top}px`;
      confirmBtn.style.left = `${left}px`;
    };
    positionBtn();
    doc.body.appendChild(confirmBtn);

    // Reposeer bij scrollen of resize
    const reposition = () => positionBtn();
    doc.defaultView?.addEventListener("scroll", reposition, { passive: true });
    doc.defaultView?.addEventListener("resize", reposition, { passive: true });

    let committed = false;

    const removeConfirmBtn = () => {
      confirmBtn.remove();
      doc.defaultView?.removeEventListener("scroll", reposition);
      doc.defaultView?.removeEventListener("resize", reposition);
    };

    const commit = (cancelled = false) => {
      if (committed) return;
      committed = true;
      removeConfirmBtn();
      el.contentEditable = "false";
      el.removeAttribute("contenteditable");
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("paste", onPaste);

      if (cancelled) {
        el.textContent = originalText;
        return;
      }
      const newText = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!newText) {
        el.textContent = originalText;
      } else if (newText !== originalText) {
        setDirty(true);
        setSaveMsg(null);
        setSaveErr(null);
      }
    };

    // pointerdown voorkomt dat focus van het element af gaat (= geen vroegtijdige blur)
    confirmBtn.addEventListener("pointerdown", (e) => e.preventDefault());
    confirmBtn.addEventListener("click", () => commit(false));

    const onBlur = () => commit(false);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        commit(true);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit(false);
      }
    };

    // Strip HTML bij plakken — alleen plain tekst
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      doc.execCommand("insertText", false, text);
    };

    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKey);
    el.addEventListener("paste", onPaste);
    el.focus();
  }, []);

  const bindIframeEditor = useCallback(() => {
    iframeCleanupRef.current?.();
    const doc = iframeRef.current?.contentDocument;
    if (!doc) {
      setScanStats(null);
      return;
    }

    // Duck-type check: werkt cross-frame zonder instanceof.
    // Elk HTMLElement heeft getAttribute — text-nodes en null niet.
    const isEl = (n: unknown): n is HTMLElement =>
      !!n && typeof (n as HTMLElement).getAttribute === "function";

    const timeouts: number[] = [];

    // Verwijder per ongeluk gezette data-portal-editable attributen van Alpine navbar-kinderen,
    // en zorg dat pointer-events: auto behouden blijft zodat Alpine-clicks doorwerken.
    const protectAlpineHeader = (d: Document) => {
      d.querySelectorAll<HTMLElement>("header[x-data], nav[x-data]").forEach((el) => {
        el.style.pointerEvents = "auto";
        el.querySelectorAll("[data-portal-editable]").forEach((child) => {
          child.removeAttribute("data-portal-editable");
        });
      });
    };

    const mark = () => {
      const stats = markIframeEditables(doc);
      protectAlpineHeader(doc);
      console.log("[portal-editor] mark →", stats, "editables:", doc.querySelectorAll("[data-portal-editable]").length);
      return stats;
    };

    // Fix overlays die editor-clicks blokkeren (imperatief, zodat ook laat-geladen elementen worden geraakt)
    doc.querySelectorAll<HTMLElement>("[data-animation]").forEach((el) => {
      el.style.pointerEvents = "none";
    });
    doc.querySelectorAll<HTMLElement>("div.absolute.inset-0").forEach((el) => {
      if (!el.getAttribute("data-portal-editable")) el.style.pointerEvents = "none";
    });

    // ── Zwevende camera-knop bij afbeeldingen (hover voor desktop) ──
    let activeCameraImg: HTMLImageElement | null = null;
    let cameraFloatBtn: HTMLElement | null = null;

    const removeCameraFloat = () => {
      cameraFloatBtn?.remove();
      cameraFloatBtn = null;
      activeCameraImg = null;
    };

    const openImagePicker = (img: HTMLImageElement) => {
      removeCameraFloat();
      setPendingImageTarget({
        imageId: img.getAttribute("data-portal-image-id") ?? "",
        sectionKey: img.closest("[data-portal-section-key]")?.getAttribute("data-portal-section-key") ?? "",
        src: img.getAttribute("src") ?? "",
        alt: img.getAttribute("alt") ?? "",
      });
      setSaveErr(null);
      fileInputRef.current?.click();
    };

    const showCameraFloat = (img: HTMLImageElement) => {
      if (activeCameraImg === img) return;
      removeCameraFloat();
      activeCameraImg = img;

      const btn = doc.createElement("button");
      btn.setAttribute("data-portal-camera-btn", "1");
      btn.setAttribute("aria-label", "Afbeelding vervangen");
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      btn.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "width:40px",
        "height:40px",
        "border-radius:50%",
        "background:#2563eb",
        "color:#fff",
        "border:none",
        "cursor:pointer",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "box-shadow:0 2px 10px rgba(0,0,0,0.28)",
        "transition:transform 120ms ease,background 120ms ease",
        "touch-action:manipulation",
        "-webkit-tap-highlight-color:transparent",
      ].join(";");

      const positionCameraBtn = () => {
        const rect = img.getBoundingClientRect();
        const top = Math.max(8, rect.top + 8);
        const left = Math.min(
          (doc.documentElement.clientWidth || 800) - 48,
          Math.max(8, rect.right - 48),
        );
        btn.style.top = `${top}px`;
        btn.style.left = `${left}px`;
      };
      positionCameraBtn();
      doc.body.appendChild(btn);
      cameraFloatBtn = btn;

      const reposCam = () => positionCameraBtn();
      doc.defaultView?.addEventListener("scroll", reposCam, { passive: true });
      doc.defaultView?.addEventListener("resize", reposCam, { passive: true });

      btn.addEventListener("pointerdown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const captured = activeCameraImg;
        if (!captured) return;
        doc.defaultView?.removeEventListener("scroll", reposCam);
        doc.defaultView?.removeEventListener("resize", reposCam);
        openImagePicker(captured);
      });
    };

    const handleMouseOver = (event: Event) => {
      if (!isEl(event.target)) return;
      const img = event.target.closest('img[data-portal-editable="image"]') as HTMLImageElement | null;
      if (img) showCameraFloat(img);
    };

    const handleMouseOut = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget;
      if (related && (cameraFloatBtn?.contains(related as Node) || cameraFloatBtn === related)) return;
      if (!isEl(event.target)) return;
      const img = event.target.closest('img[data-portal-editable="image"]') as HTMLImageElement | null;
      if (img && activeCameraImg === img) removeCameraFloat();
    };

    // Enkele klik → afbeelding vervangen of tekst bewerken
    const handleClick = (event: Event) => {
      const target = event.target;
      console.log("[portal-editor] click", target, "isEl=", isEl(target));
      if (!isEl(target)) return;
      // Al in een actieve contenteditable → niets doen
      if (target.closest('[contenteditable="true"]')) return;

      // Nav-link → wissel van pagina in de editor. Ook hash-fragmenten (`#diensten`,
      // `#over-ons`) worden meegenomen, omdat de AI-postprocess cross-page links op de
      // homepage vaak herschrijft naar in-page hashes. Als het fragment geen bekende
      // editor-pagina matcht, laten we de default (scroll) gewoon doorgaan.
      const navLink = target.closest(
        "nav a[href], header a[href], [role='navigation'] a[href], [role='banner'] a[href]",
      ) as HTMLAnchorElement | null;
      if (navLink) {
        const href = navLink.getAttribute("href") ?? "";
        if (href && !/^(mailto:|tel:|javascript:)/i.test(href)) {
          const targetPageId = resolveNavHrefToPageId(href, pages);
          if (targetPageId && targetPageId !== selectedPageId) {
            event.preventDefault();
            event.stopPropagation();
            void onSelectPageRef.current?.(targetPageId);
            return;
          }
        }
      }

      // Afbeelding: closest() is voldoende want img heeft geen kinderen
      const image = target.closest('img[data-portal-editable="image"]') as HTMLImageElement | null;
      if (image) {
        event.preventDefault();
        event.stopPropagation();
        openImagePicker(image);
        return;
      }

      // Tekst zoeken. Met pointer-events: auto op [data-portal-editable] landt de click al op het
      // juiste element — de omhoog-walk is dan voldoende. querySelector is vangnet voor edge-cases.
      let textEl: HTMLElement | null = null;

      // 1. Omhoog via parentElement (normaal geval: click landt op het editable zelf of een child ervan)
      let node: Element | null = target as Element;
      while (node) {
        if (isEl(node) && node.getAttribute("data-portal-editable") === "text") {
          textEl = node;
          break;
        }
        node = node.parentElement;
      }

      // 2. Omlaag via querySelector (vangnet: click landt op een wrapper boven alle editables)
      if (!textEl) {
        const found = target.querySelector('[data-portal-editable="text"]');
        if (isEl(found)) textEl = found;
      }

      console.log("[portal-editor] textEl=", textEl);
      if (textEl && textEl.getAttribute("contenteditable") !== "true") {
        event.preventDefault();
        event.stopPropagation();
        console.log("[portal-editor] activeren →", textEl.tagName, textEl.textContent?.slice(0, 30));
        activateInlineEdit(doc, textEl);
      }
    };

    const observer = new MutationObserver(() => mark());
    doc.addEventListener("click", handleClick, true);
    doc.addEventListener("mouseover", handleMouseOver, true);
    doc.addEventListener("mouseout", handleMouseOut, true);
    observer.observe(doc.documentElement, { childList: true, subtree: true });

    let tries = 0;
    const markWithRetry = () => {
      const stats = mark();
      if ((stats.sections > 0 && stats.text > 0) || tries >= 20) return;
      tries += 1;
      timeouts.push(window.setTimeout(markWithRetry, 100));
    };
    markWithRetry();
    timeouts.push(window.setTimeout(markWithRetry, 120));
    timeouts.push(window.setTimeout(markWithRetry, 480));

    iframeCleanupRef.current = () => {
      observer.disconnect();
      doc.removeEventListener("click", handleClick, true);
      doc.removeEventListener("mouseover", handleMouseOver, true);
      doc.removeEventListener("mouseout", handleMouseOut, true);
      removeCameraFloat();
      for (const t of timeouts) window.clearTimeout(t);
    };
  }, [activateInlineEdit, markIframeEditables, pages, selectedPageId]);

  const requestSnapshot = useCallback(() => {
    const directDoc = iframeRef.current?.contentDocument;
    if (!directDoc) return Promise.reject(new Error("Preview niet beschikbaar."));
    return Promise.resolve(extractSnapshotFromDocument(directDoc));
  }, [extractSnapshotFromDocument]);

  const flushCurrentPageSnapshot = useCallback(async () => {
    if (!currentPage) return pageStates;
    const snapshot = await requestSnapshot();
    const nextPageStates = {
      ...pageStates,
      [currentPage.id]: mergeSnapshotIntoSections(pageStates[currentPage.id] ?? currentPage.sections, snapshot),
    };
    setPageStates(nextPageStates);
    return nextPageStates;
  }, [currentPage, mergeSnapshotIntoSections, pageStates, requestSnapshot]);

  useEffect(() => () => iframeCleanupRef.current?.(), []);

  const hasUnsavedChanges =
    dirty ||
    titleValue.trim() !== savedTitleValue.trim() ||
    JSON.stringify(pageConfigValue ?? null) !== JSON.stringify(savedPageConfigValue ?? null);

  const onSelectPage = useCallback(
    async (pageId: string) => {
      if (pageId === selectedPageId) return;
      setSwitchingPage(true);
      setSaveErr(null);
      try {
        await flushCurrentPageSnapshot();
        setSelectedPageId(pageId);
        setPendingImageTarget(null);
      } catch (error) {
        setSaveErr(error instanceof Error ? error.message : "Pagina wisselen mislukt.");
      } finally {
        setSwitchingPage(false);
      }
    },
    [flushCurrentPageSnapshot, selectedPageId],
  );
  onSelectPageRef.current = onSelectPage;

  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const nextPageStates = await flushCurrentPageSnapshot();
      const res = await fetch(`/api/portal/clients/${enc}/draft-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTitle: titleValue.trim() || undefined,
          pageConfig: pageConfigValue ?? undefined,
          patches: pages.flatMap((page) =>
            (nextPageStates[page.id] ?? [])
              // Structurele secties (navbar/footer/nav) nooit als patch doorsturen — die mogen de
              // server-sanitizer niet (opnieuw) doorlopen, anders raakt de originele nav corrupted.
              .filter(({ section }) => !/^<(header|footer|nav)\b/i.test(section.html.trimStart()))
              .map((section) => ({ key: section.key, html: section.section.html })),
          ),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSaveErr(json.error ?? "Opslaan mislukt.");
        return;
      }
      setDirty(false);
      setSavedTitleValue(titleValue);
      setSavedPageConfigValue(pageConfigValue ?? null);
      setSaveMsg("Concept opgeslagen.");
    } catch (error) {
      setSaveErr(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }, [enc, flushCurrentPageSnapshot, pageConfigValue, pages, titleValue]);

  const onPublishLive = useCallback(async () => {
    setPublishing(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      // Sla eerst als concept op (ook als er geen wijzigingen zijn, zodat de laatste state zeker staat)
      const nextPageStates = await flushCurrentPageSnapshot();
      const saveRes = await fetch(`/api/portal/clients/${enc}/draft-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTitle: titleValue.trim() || undefined,
          pageConfig: pageConfigValue ?? undefined,
          patches: pages.flatMap((page) =>
            (nextPageStates[page.id] ?? [])
              .filter(({ section }) => !/^<(header|footer|nav)\b/i.test(section.html.trimStart()))
              .map((section) => ({ key: section.key, html: section.section.html })),
          ),
        }),
      });
      const saveJson = (await saveRes.json()) as { ok?: boolean; error?: string };
      if (!saveRes.ok || !saveJson.ok) {
        setSaveErr(saveJson.error ?? "Opslaan mislukt.");
        return;
      }
      setDirty(false);
      setSavedTitleValue(titleValue);
      setSavedPageConfigValue(pageConfigValue ?? null);

      // Publiceer het concept direct live
      const pubRes = await fetch(`/api/portal/clients/${enc}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const pubJson = (await pubRes.json()) as { ok?: boolean; error?: string };
      if (!pubRes.ok || !pubJson.ok) {
        setSaveErr(pubJson.error ?? "Publiceren mislukt.");
        return;
      }
      setSaveMsg("✓ Live gezet! Bezoekers zien de wijzigingen nu op je publieke site.");
    } catch (error) {
      setSaveErr(error instanceof Error ? error.message : "Publiceren mislukt.");
    } finally {
      setPublishing(false);
    }
  }, [enc, flushCurrentPageSnapshot, pageConfigValue, pages, titleValue]);

  /**
   * Bouwt uit `pageStates` een restyle-payload (config + main/contact/marketingPages arrays).
   * Alle *structurele* secties (header/footer/nav) gaan mee — die moeten mee-restylen.
   * We behouden de volgorde en aantal 1-op-1 met `pages[i].sections`, zodat de server-response
   * per index-mapping terug naar de editor-state kan worden geschreven.
   */
  const buildRestylePayloadFromPages = useCallback(
    (source: Record<string, EditableSection[]>, baseConfig: TailwindPageConfig) => {
      const mainSections: TailwindSection[] = [];
      const contactSections: TailwindSection[] = [];
      const marketingPages: Record<string, TailwindSection[]> = {};

      for (const page of pages) {
        const items = source[page.id] ?? page.sections;
        const sectionList = items.map((item) => item.section);
        if (page.id === "main" || page.id.startsWith("main:")) {
          mainSections.push(...sectionList);
        } else if (page.id === "contact" || page.id.startsWith("contact:")) {
          contactSections.push(...sectionList);
        } else if (page.id.startsWith("marketing:")) {
          const key = page.id.slice("marketing:".length);
          if (key) marketingPages[key] = sectionList;
        }
      }

      const payload: {
        config: TailwindPageConfig;
        sections: TailwindSection[];
        contactSections?: TailwindSection[];
        marketingPages?: Record<string, TailwindSection[]>;
        documentTitle?: string;
      } = {
        config: baseConfig,
        sections: mainSections,
      };
      if (contactSections.length > 0) payload.contactSections = contactSections;
      if (Object.keys(marketingPages).length > 0) payload.marketingPages = marketingPages;
      const trimmedTitle = titleValue.trim();
      if (trimmedTitle) payload.documentTitle = trimmedTitle;
      return payload;
    },
    [pages, titleValue],
  );

  /**
   * Bouwt nieuwe `pageStates` uit een restyle-response. Sectie-keys (`main:0`, `contact:1`,
   * `marketing:x:2`) blijven 1-op-1 behouden omdat Claude elke index ongewijzigd teruglevert —
   * alleen de HTML/kleuren veranderen.
   */
  const pageStatesFromRestyleResponse = useCallback(
    (restyled: RestyleResponsePayload): Record<string, EditableSection[]> => {
      const next: Record<string, EditableSection[]> = {};
      for (const page of pages) {
        let pool: TailwindSection[] = [];
        if (page.id === "main" || page.id.startsWith("main:")) {
          pool = restyled.sections;
        } else if (page.id === "contact" || page.id.startsWith("contact:")) {
          pool = restyled.contactSections ?? [];
        } else if (page.id.startsWith("marketing:")) {
          const key = page.id.slice("marketing:".length);
          pool = restyled.marketingPages?.[key] ?? [];
        }

        const existing = pageStates[page.id] ?? page.sections;
        const rebuilt: EditableSection[] = existing.map((item, index) => {
          const freshSection = pool[index];
          if (!freshSection) return item;
          return {
            ...item,
            section: { ...item.section, ...freshSection },
          };
        });
        next[page.id] = rebuilt;
      }
      return next;
    },
    [pageStates, pages],
  );

  const onSelectTheme = useCallback(
    async (themeId: ThemePresetId) => {
      if (restylingThemeId || saving || publishing || switchingPage || uploadingImage) return;
      if (activePresetId === themeId) return;

      setRestylingThemeId(themeId);
      setSaveErr(null);
      setSaveMsg(null);

      try {
        const snapshotPageStates = await flushCurrentPageSnapshot();
        // Belangrijk: `payload.config` is de *baseline* waarvan de server Donker/Warm afleidt.
        // We gebruiken bewust de mount-time config (niet `pageConfigValue`) zodat:
        //  - Donker → Warm → Donker niet compound (warm-van-donker-van-origineel ≠ donker-van-origineel).
        //  - Het server-side afgeleide doel-palet exact overeenkomt met wat `themePresets` lokaal toont,
        //    zodat `activePresetId` na de round-trip de juiste preset highlight.
        const baselineConfig = basePageConfigRef.current;
        if (!baselineConfig) {
          setSaveErr("Geen pageConfig beschikbaar; deze site kan niet van thema wisselen.");
          return;
        }

        const currentPayload = buildRestylePayloadFromPages(snapshotPageStates, baselineConfig);

        // De server owned de "origineel"-baseline via `clients.theme_variants` (lazy-captured op
        // eerste restyle, en daarna nooit meer overschreven door dark/warm). Dark/warm-varianten
        // worden server-side gecached zodat terug-schakelen tussen presets geen Claude-call vergt.
        const res = await fetch(`/api/portal/clients/${enc}/restyle-theme`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ themeId, payload: currentPayload }),
        });

        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: {
            snapshot_id?: string;
            documentTitle?: string;
            payload?: RestyleResponsePayload;
          };
        };

        if (!res.ok || !json.ok || !json.data?.payload) {
          setSaveErr(json.error ?? "Thema wisselen mislukt.");
          return;
        }

        const restyled = json.data.payload;
        const nextPageStates = pageStatesFromRestyleResponse(restyled);
        setPageStates(nextPageStates);
        setPageConfigValue(restyled.config);
        setSavedPageConfigValue(restyled.config);
        if (json.data.documentTitle) {
          setTitleValue(json.data.documentTitle);
          setSavedTitleValue(json.data.documentTitle);
        }
        setDirty(false);
        setSaveMsg(
          themeId === "original"
            ? "Originele kleuren hersteld en opgeslagen als concept."
            : themeId === "light"
              ? "Lichte variant toegepast en opgeslagen als concept."
              : themeId === "dark"
                ? "Donkere variant toegepast en opgeslagen als concept."
                : "Warme variant toegepast en opgeslagen als concept.",
        );
      } catch (error) {
        setSaveErr(error instanceof Error ? error.message : "Thema wisselen mislukt.");
      } finally {
        setRestylingThemeId(null);
      }
    },
    [
      activePresetId,
      buildRestylePayloadFromPages,
      enc,
      flushCurrentPageSnapshot,
      pageStatesFromRestyleResponse,
      publishing,
      restylingThemeId,
      saving,
      switchingPage,
      uploadingImage,
    ],
  );

  const onImageFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pendingImageTarget) return;
      setUploadingImage(true);
      setSaveErr(null);
      setSaveMsg(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/portal/clients/${enc}/site-asset`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as { ok?: boolean; error?: string; url?: string };
        if (!res.ok || !json.ok || !json.url) {
          setSaveErr(json.error ?? "Upload mislukt.");
          return;
        }
        const directDoc = iframeRef.current?.contentDocument;
        const directImage = directDoc?.querySelector(
          `img[data-portal-image-id="${pendingImageTarget.imageId}"]`,
        ) as HTMLImageElement | null;
        if (directImage) {
          directImage.setAttribute("src", json.url);
          directImage.setAttribute("alt", pendingImageTarget.alt);
        }
        setDirty(true);
        setPendingImageTarget(null);
        setSaveMsg("Afbeelding vervangen — sla op als concept om te bewaren.");
      } catch {
        setSaveErr("Upload mislukt.");
      } finally {
        event.target.value = "";
        setUploadingImage(false);
      }
    },
    [enc, pendingImageTarget],
  );

  const onIframeLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    // Wacht 500 ms zodat Alpine.js en andere iframe-scripts volledig geïnitialiseerd zijn
    // voordat we de editor binden en markeren.
    setTimeout(() => {
      bindIframeEditor();
      if (win) {
        const tryMark = (attempts = 0) => {
          const doc = iframeRef.current?.contentDocument;
          if (!doc) return;
          const stats = markIframeEditables(doc);
          if (stats.text === 0 && attempts < 20) {
            win.setTimeout(() => tryMark(attempts + 1), 200);
          }
        };
        win.setTimeout(tryMark, 300);
      }
    }, 500);
  }, [bindIframeEditor, markIframeEditables]);

  return (
    <div className="relative left-1/2 right-1/2 w-screen max-w-none -translate-x-1/2 px-2 sm:px-4 lg:px-6 xl:px-8">
      <section className="overflow-hidden border-y border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:border">

        {/* ── Header: titel + knoppen ── */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <label className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">Browsertitel</label>
            <input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-xs"
              placeholder="Naam in de browsertab"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Open publieke site */}
            {publicSiteUrl ? (
              <a
                href={publicSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ExternalLink className="size-4" aria-hidden />
                <span className="hidden sm:inline">Publieke site</span>
              </a>
            ) : null}
            {/* Opslaan als concept */}
            <button
              type="button"
              disabled={saving || publishing || switchingPage || uploadingImage || !!restylingThemeId || !hasUnsavedChanges}
              onClick={() => void onSave()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {saving ? "Bezig…" : "Concept"}
            </button>
            {/* Publiceer live */}
            <button
              type="button"
              disabled={saving || publishing || switchingPage || uploadingImage || !!restylingThemeId}
              onClick={() => void onPublishLive()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
              {publishing ? "Publiceren…" : "Publiceer live"}
            </button>
          </div>
        </div>

        {/* ── Thema-presets: horizontale scroll-rij + individuele kleuren ── */}
        {themePresets.length > 0 ? (
          <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Paintbrush className="size-3.5" aria-hidden />
              Thema
              {restylingThemeId ? (
                <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white normal-case tracking-normal dark:bg-zinc-100 dark:text-zinc-900">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  {restylingThemeId === "original"
                    ? "Originele kleuren herstellen…"
                    : restylingThemeId === "light"
                      ? "Lichte variant berekenen (30–60 sec)…"
                      : restylingThemeId === "dark"
                        ? "Donkere variant berekenen (30–60 sec)…"
                        : "Warme variant berekenen (30–60 sec)…"}
                </span>
              ) : (
                <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
                  Sla om naar een andere kleurrichting — AI-herstijl en automatisch opgeslagen
                </span>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {themePresets.map((preset) => {
                const active = activePresetId === preset.id;
                const loadingThis = restylingThemeId === preset.id;
                const disabled =
                  !!restylingThemeId ||
                  saving ||
                  publishing ||
                  switchingPage ||
                  uploadingImage;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    title={preset.description}
                    onClick={() => void onSelectTheme(preset.id)}
                    className={[
                      "flex shrink-0 flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                      active
                        ? "border-zinc-900 bg-white shadow-sm dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 bg-zinc-50 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800",
                      disabled ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                    style={{ minWidth: "9rem" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{preset.label}</p>
                      {loadingThis ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-zinc-500" aria-hidden />
                      ) : active ? (
                        <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : null}
                    </div>
                    <div className="flex gap-1.5">
                      {preset.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="size-4 rounded-full border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        ) : null}

        {/* ── Huidige pagina + scan-info ── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-6">
          <span className="text-zinc-500 dark:text-zinc-400">
            Pagina:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {currentPage?.label ?? "—"}
            </span>
          </span>
          <span className="hidden text-zinc-300 dark:text-zinc-700 sm:inline">·</span>
          <span className="text-zinc-400 dark:text-zinc-500">
            Klik op een menulink in de preview om naar een andere pagina te gaan
          </span>
          <span className="ml-auto text-zinc-400 dark:text-zinc-500">
            {scanStats
              ? `${scanStats.text} tekstvlakken · ${scanStats.images} afbeeldingen`
              : "Scan bezig…"}
          </span>
        </div>

        {/* ── Iframe ── */}
        <div className="relative border-t border-zinc-100 dark:border-zinc-800">
          {switchingPage ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-zinc-900/70">
              <Loader2 className="size-6 animate-spin text-zinc-500" aria-hidden />
            </div>
          ) : null}
          {restylingThemeId ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center dark:bg-zinc-900/85">
              <Loader2 className="size-8 animate-spin text-zinc-700 dark:text-zinc-200" aria-hidden />
              <p className="max-w-sm text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {restylingThemeId === "original"
                  ? "Originele kleuren worden hersteld…"
                  : restylingThemeId === "light"
                    ? "De site wordt in lichte tonen herkleurd…"
                    : restylingThemeId === "dark"
                      ? "De site wordt in donkere tonen herkleurd…"
                      : "De site wordt in warme tonen herkleurd…"}
              </p>
              <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Dit duurt meestal 30 tot 60 seconden. Je tekst- en fotowijzigingen blijven behouden.
              </p>
            </div>
          ) : null}
          <iframe
            id="site-preview"
            ref={iframeRef}
            title="Klant website editor"
            className="h-[70dvh] min-h-[520px] w-full border-0 bg-white lg:h-[calc(100dvh-14rem)] lg:min-h-[700px]"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            srcDoc={srcDoc}
            onLoad={onIframeLoad}
          />
        </div>

        {/* ── Statusbalk onderaan ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 px-4 py-3 text-xs dark:border-zinc-800 sm:px-6">
          <span className="text-zinc-400 dark:text-zinc-500">
            {uploadingImage ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Afbeelding uploaden…
              </span>
            ) : (
              "Klik op tekst om direct te bewerken · Klik op een foto om te vervangen"
            )}
          </span>
          {saveErr ? <span className="font-medium text-red-600 dark:text-red-400">{saveErr}</span> : null}
          {saveMsg && !saveErr ? <span className="font-medium text-emerald-700 dark:text-emerald-400">{saveMsg}</span> : null}
          <span className="ml-auto text-zinc-300 dark:text-zinc-600">
            Dit scherm verandert alleen het klantportaal
          </span>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(event) => void onImageFileChange(event)}
      />
    </div>
  );
}
