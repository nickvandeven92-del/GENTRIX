"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, ImagePlus, Loader2, Paintbrush, Save } from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildTailwindIframeSrcDoc } from "@/components/site/tailwind-sections-preview";
import { buildPortalThemePresets } from "@/lib/portal/portal-theme-presets";

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

type PortalEditorMessage =
  | { source: "portal-site-editor"; type: "portal-dirty" }
  | {
      source: "portal-site-editor";
      type: "portal-select-image";
      imageId: string;
      sectionKey: string;
      src: string;
      alt: string;
    }
  | {
      source: "portal-site-editor";
      type: "portal-snapshot";
      sections: SnapshotSection[];
    };

type Props = {
  slug: string;
  clientName: string;
  documentTitle: string;
  pages: PortalEditorPage[];
  pageConfig?: TailwindPageConfig | null;
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  compiledTailwindCss?: string | null;
};

const MESSAGE_SOURCE = "portal-site-editor";

function isPortalEditorMessage(data: unknown): data is PortalEditorMessage {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  if (row.source !== MESSAGE_SOURCE || typeof row.type !== "string") return false;
  if (row.type === "portal-dirty") return true;
  if (row.type === "portal-select-image") {
    return (
      typeof row.imageId === "string" &&
      typeof row.sectionKey === "string" &&
      typeof row.src === "string" &&
      typeof row.alt === "string"
    );
  }
  if (row.type === "portal-snapshot") {
    return Array.isArray(row.sections);
  }
  return false;
}

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
  transition: outline-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
}

[data-portal-editable="text"]:hover,
[data-portal-editable="image"]:hover {
  outline: 2px solid rgba(37, 99, 235, 0.72);
  outline-offset: 3px;
}

[data-portal-editing="1"] {
  outline: 2px solid rgba(16, 185, 129, 0.9) !important;
  outline-offset: 3px;
  background: rgba(236, 253, 245, 0.92) !important;
}
`;
}

function buildPortalEditorScript(): string {
  return `<script>
(function(){
  var SOURCE = "portal-site-editor";
  var ROOT_SELECTOR = "[data-portal-section-key]";
  var TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,a,button,blockquote,figcaption";
  var activeTextEl = null;

  function post(payload){
    try{ parent.postMessage(Object.assign({ source: SOURCE }, payload), "*"); }catch(_){ }
  }

  function normalizeText(value){
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function findSectionKey(node){
    var section = node && node.closest ? node.closest(ROOT_SELECTOR) : null;
    return section ? (section.getAttribute("data-portal-section-key") || "") : "";
  }

  function isTextCandidate(el){
    if(!el || !el.matches || !el.matches(TEXT_SELECTOR)) return false;
    if(el.closest("script,style,noscript")) return false;
    if(el.children.length !== 0) return false;
    return normalizeText(el.textContent || "").length > 0;
  }

  function markEditableNodes(){
    var textIndex = 0;
    var imageIndex = 0;
    document.querySelectorAll(ROOT_SELECTOR).forEach(function(section){
      section.querySelectorAll(TEXT_SELECTOR).forEach(function(el){
        if(!isTextCandidate(el)) return;
        el.setAttribute("data-portal-editable", "text");
        el.setAttribute("data-portal-text-id", "text-" + String(textIndex++));
      });
      section.querySelectorAll("img").forEach(function(img){
        img.setAttribute("data-portal-editable", "image");
        img.setAttribute("data-portal-image-id", "image-" + String(imageIndex++));
      });
    });
  }

  function placeCaretAtEnd(el){
    try{
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      if(!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    }catch(_){ }
  }

  function commitText(el){
    if(!el) return;
    var next = normalizeText(el.textContent || "");
    el.textContent = next;
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
    el.removeAttribute("data-portal-editing");
    if(activeTextEl === el) activeTextEl = null;
    post({ type: "portal-dirty" });
  }

  function commitActiveText(){
    if(activeTextEl) commitText(activeTextEl);
  }

  function startTextEdit(el){
    if(activeTextEl && activeTextEl !== el) commitText(activeTextEl);
    activeTextEl = el;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("data-portal-editing", "1");
    el.focus();
    placeCaretAtEnd(el);
  }

  function cleanClone(section){
    var clone = section.cloneNode(true);
    var all = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("*")));
    all.forEach(function(node){
      Array.prototype.slice.call(node.attributes || []).forEach(function(attr){
        if(attr && /^data-portal-/.test(attr.name)) node.removeAttribute(attr.name);
      });
      node.removeAttribute("contenteditable");
      node.removeAttribute("spellcheck");
    });
    return clone.innerHTML;
  }

  function emitSnapshot(){
    commitActiveText();
    var sections = [];
    document.querySelectorAll(ROOT_SELECTOR).forEach(function(section){
      var key = section.getAttribute("data-portal-section-key") || "";
      sections.push({ key: key, html: cleanClone(section) });
    });
    post({ type: "portal-snapshot", sections: sections });
  }

  function handleClick(event){
    var target = event.target;
    if(!target || !target.closest) return;
    var image = target.closest('img[data-portal-editable="image"]');
    if(image){
      event.preventDefault();
      event.stopPropagation();
      commitActiveText();
      post({
        type: "portal-select-image",
        imageId: image.getAttribute("data-portal-image-id") || "",
        sectionKey: findSectionKey(image),
        src: image.getAttribute("src") || "",
        alt: image.getAttribute("alt") || "",
      });
      return;
    }
    var text = target.closest('[data-portal-editable="text"]');
    if(text){
      event.preventDefault();
      event.stopPropagation();
      startTextEdit(text);
    }
  }

  function handleFocusOut(event){
    if(!activeTextEl || event.target !== activeTextEl) return;
    window.setTimeout(function(){
      if(!activeTextEl) return;
      if(document.activeElement === activeTextEl) return;
      commitText(activeTextEl);
    }, 0);
  }

  function handleKeyDown(event){
    if(!activeTextEl) return;
    if(event.key === "Escape"){
      event.preventDefault();
      commitText(activeTextEl);
      return;
    }
    if(event.key === "Enter" && !event.shiftKey){
      event.preventDefault();
      activeTextEl.blur();
    }
  }

  function handleParentMessage(event){
    var data = event.data;
    if(!data || typeof data !== "object" || typeof data.type !== "string") return;
    if(data.type === "portal-request-snapshot"){
      emitSnapshot();
      return;
    }
    if(data.type === "portal-apply-image"){
      var id = typeof data.imageId === "string" ? data.imageId : "";
      var src = typeof data.src === "string" ? data.src : "";
      if(!id || !src) return;
      var selector = 'img[data-portal-image-id="' + id.replace(/"/g, '\\"') + '"]';
      var image = document.querySelector(selector);
      if(!image) return;
      image.setAttribute("src", src);
      if(typeof data.alt === "string") image.setAttribute("alt", data.alt);
      post({ type: "portal-dirty" });
    }
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("focusout", handleFocusOut, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("message", handleParentMessage);

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", markEditableNodes, { once: true });
  } else {
    markEditableNodes();
  }
})();
<\/script>`;
}

function injectPortalEditorIntoSrcDoc(doc: string): string {
  const styleTag = `<style id="portal-visual-editor-css">${buildPortalEditorCss()}</style>`;
  const scriptTag = buildPortalEditorScript();
  const withHead = doc.includes("</head>") ? doc.replace("</head>", `${styleTag}</head>`) : `${styleTag}${doc}`;
  return withHead.includes("</body>") ? withHead.replace("</body>", `${scriptTag}</body>`) : `${withHead}${scriptTag}`;
}

export function PortalVisualSiteEditor({
  slug,
  clientName,
  documentTitle,
  pages,
  pageConfig,
  userCss,
  userJs,
  logoSet,
  compiledTailwindCss,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapshotResolverRef = useRef<((sections: SnapshotSection[]) => void) | null>(null);
  const basePageConfigRef = useRef<TailwindPageConfig | null>(pageConfig ?? null);
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
  const [switchingPage, setSwitchingPage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [pendingImageTarget, setPendingImageTarget] = useState<{
    imageId: string;
    sectionKey: string;
    src: string;
    alt: string;
  } | null>(null);

  const enc = encodeURIComponent(decodeURIComponent(slug));
  const currentPage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;
  const currentSections = currentPage ? pageStates[currentPage.id] ?? currentPage.sections : [];
  const themePresets = useMemo(
    () => buildPortalThemePresets(basePageConfigRef.current),
    [],
  );
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
      userCss,
      userJs,
      logoSet,
      publishedSlug: decodeURIComponent(slug),
      compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
      navBrandLabel: clientName,
    });
    return injectPortalEditorIntoSrcDoc(base);
  }, [clientName, compiledTailwindCss, currentPage, logoSet, pageConfigValue, previewSections, slug, userCss, userJs]);

  const mergeSnapshotIntoSections = useCallback((baseSections: EditableSection[], snapshot: SnapshotSection[]) => {
    const htmlByKey = new Map(snapshot.map((item) => [item.key, item.html]));
    return baseSections.map((item) =>
      htmlByKey.has(item.key)
        ? { ...item, section: { ...item.section, html: htmlByKey.get(item.key) ?? item.section.html } }
        : item,
    );
  }, []);

  const requestSnapshot = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return Promise.reject(new Error("Preview niet beschikbaar."));
    return new Promise<SnapshotSection[]>((resolve, reject) => {
      snapshotResolverRef.current = resolve;
      try {
        target.postMessage({ type: "portal-request-snapshot" }, "*");
      } catch {
        snapshotResolverRef.current = null;
        reject(new Error("Kon preview niet aanspreken."));
      }
      window.setTimeout(() => {
        if (snapshotResolverRef.current !== resolve) return;
        snapshotResolverRef.current = null;
        reject(new Error("Geen antwoord uit de preview ontvangen."));
      }, 3000);
    });
  }, []);

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

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isPortalEditorMessage(event.data)) return;

      if (event.data.type === "portal-dirty") {
        setDirty(true);
        setSaveErr(null);
        return;
      }

      if (event.data.type === "portal-select-image") {
        setPendingImageTarget({
          imageId: event.data.imageId,
          sectionKey: event.data.sectionKey,
          src: event.data.src,
          alt: event.data.alt,
        });
        setSaveErr(null);
        queueMicrotask(() => fileInputRef.current?.click());
        return;
      }

      if (event.data.type === "portal-snapshot") {
        snapshotResolverRef.current?.(event.data.sections);
        snapshotResolverRef.current = null;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
      } catch (error) {
        setSaveErr(error instanceof Error ? error.message : "Pagina wisselen mislukt.");
      } finally {
        setSwitchingPage(false);
      }
    },
    [flushCurrentPageSnapshot, selectedPageId],
  );

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
            (nextPageStates[page.id] ?? []).map((section) => ({ key: section.key, html: section.section.html })),
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
      setSaveMsg("Concept opgeslagen. Publiceer hieronder wanneer de klantversie live mag.");
    } catch (error) {
      setSaveErr(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }, [enc, flushCurrentPageSnapshot, pageConfigValue, pages, titleValue]);

  const onImageFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
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
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "portal-apply-image",
          imageId: pendingImageTarget.imageId,
          src: json.url,
          alt: pendingImageTarget.alt,
        },
        "*",
      );
      setDirty(true);
      setPendingImageTarget(null);
      setSaveMsg("Afbeelding vervangen. Sla op als concept om de wijziging te bewaren.");
    } catch {
      setSaveErr("Upload mislukt.");
    } finally {
      event.target.value = "";
      setUploadingImage(false);
    }
  }, [enc, pendingImageTarget]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Visuele website-editor</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Dit is alleen voor de klant in het portaal. Klik direct op tekst in de preview om te typen,
            of klik op een afbeelding om die te vervangen. De indeling van de site blijft vast staan, ook op contact-
            en marketingpagina’s.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || switchingPage || uploadingImage || !hasUnsavedChanges}
          onClick={() => void onSave()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Opslaan als concept
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            {pages.map((page) => {
              const active = page.id === selectedPageId;
              return (
                <button
                  key={page.id}
                  type="button"
                  disabled={switchingPage || saving}
                  onClick={() => void onSelectPage(page.id)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {page.label}
                </button>
              );
            })}
            <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
              {currentPage ? `Je bewerkt nu: ${currentPage.label}` : "Geen pagina geselecteerd"}
            </div>
          </div>
          <iframe
            ref={iframeRef}
            title="Klant website editor"
            className="h-[75vh] w-full border-0 bg-white"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            srcDoc={srcDoc}
          />
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/70">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Browsertitel</label>
          <input
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Naam in de browsertab"
          />

          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Paintbrush className="size-3.5" aria-hidden />
              Thema
            </div>
            <div className="mt-2 space-y-2">
              {themePresets.length > 0 ? (
                themePresets.map((preset) => {
                  const active = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPageConfigValue(preset.pageConfig);
                        setDirty(true);
                        setSaveMsg(null);
                      }}
                      className={[
                        "w-full rounded-xl border p-3 text-left transition",
                        active
                          ? "border-zinc-900 bg-white shadow-sm dark:border-zinc-100 dark:bg-zinc-900"
                          : "border-zinc-200 bg-white/80 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/70 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{preset.label}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{preset.description}</p>
                        </div>
                        {active ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /> : null}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {preset.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="size-6 rounded-full border border-black/10 dark:border-white/10"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-white/80 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
                  Thema-varianten zijn alleen beschikbaar voor moderne Tailwind-stijlen.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>Klik op een kop, paragraaf of lijstregel in de preview en typ direct je nieuwe tekst.</p>
            <p>Klik op een foto om een nieuwe afbeelding te uploaden. De verhoudingen van de site blijven staan.</p>
            <p>Je kunt schakelen tussen home, contact en marketingpagina’s zonder een losse tweede editor te openen.</p>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Afbeelding vervangen</p>
            {pendingImageTarget ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">Geselecteerd beeld: {pendingImageTarget.sectionKey}</p>
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  {uploadingImage ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                  Kies nieuwe afbeelding
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Klik eerst op een afbeelding in de preview.</p>
            )}
          </div>

          {saveErr ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{saveErr}</p> : null}
          {saveMsg ? <p className="mt-4 text-sm text-emerald-800 dark:text-emerald-200">{saveMsg}</p> : null}

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Dit scherm verandert alleen het klantportaal. Studio, generator en interne editor blijven onaangeraakt.
          </p>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(event) => void onImageFileChange(event)}
      />
    </section>
  );
}