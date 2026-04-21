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

type ScanStats = {
  sections: number;
  text: number;
  images: number;
};

type SelectedTextBlock = {
  textId: string;
  sectionKey: string;
  tagName: string;
  originalText: string;
  draftText: string;
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
[data-portal-editable="image"],
[data-editable="text"],
[data-editable="image"] {
  cursor: pointer;
  transition: outline-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
}

[data-portal-editable="text"],
[data-editable="text"] {
  position: relative;
  display: block;
  min-height: 1.5em;
  outline: 1px dashed rgba(37, 99, 235, 0.4);
  outline-offset: 3px;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
  background: rgba(239, 246, 255, 0.2);
}

[data-portal-editable="text"]:hover,
[data-portal-editable="image"]:hover,
[data-editable="text"]:hover,
[data-editable="image"]:hover {
  outline: 2px solid rgba(37, 99, 235, 0.72);
  outline-offset: 3px;
}

[data-portal-editable="text"]:hover,
[data-editable="text"]:hover {
  background: rgba(219, 234, 254, 0.42);
}

[data-portal-selected="1"] {
  outline: 2px solid rgba(16, 185, 129, 0.92) !important;
  outline-offset: 3px;
  background: rgba(236, 253, 245, 0.92) !important;
}
`;
}

function injectPortalEditorIntoSrcDoc(doc: string): string {
  const styleTag = `<style id="portal-visual-editor-css">${buildPortalEditorCss()}</style>`;
  const markScript = `<script>
(function(){
  function mark(){
    var sections = document.querySelectorAll('[data-portal-section-key]');
    if(!sections.length) return 0;
    var ti=0, ii=0;
    sections.forEach(function(section){
      section.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption').forEach(function(el){
        if(el.closest('nav,header,footer,a,button')) return;
        var text=(el.textContent||'').replace(/\\s+/g,' ').trim();
        if(!text) return;
        el.setAttribute('data-portal-editable','text');
        el.setAttribute('data-editable','text');
        el.setAttribute('data-portal-text-id','text-'+ti++);
      });
      section.querySelectorAll('img').forEach(function(img){
        if(img.closest('a,button,nav,header')) return;
        img.setAttribute('data-portal-editable','image');
        img.setAttribute('data-editable','image');
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
  userCss,
  userJs,
  logoSet,
  compiledTailwindCss,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeCleanupRef = useRef<(() => void) | null>(null);
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
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [selectedTextBlock, setSelectedTextBlock] = useState<SelectedTextBlock | null>(null);
  const [pendingImageTarget, setPendingImageTarget] = useState<{
    imageId: string;
    sectionKey: string;
    src: string;
    alt: string;
  } | null>(null);

  const enc = encodeURIComponent(decodeURIComponent(slug));
  const currentPage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;
  const currentSections = currentPage ? pageStates[currentPage.id] ?? currentPage.sections : [];
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

  const normalizeEditableText = useCallback((value: string) => value.replace(/\s+/g, " ").trim(), []);

  const clearSelectedTextHighlight = useCallback((doc?: Document | null) => {
    const targetDoc = doc ?? iframeRef.current?.contentDocument;
    targetDoc?.querySelectorAll('[data-portal-selected="1"]').forEach((node) => {
      node.removeAttribute("data-portal-selected");
    });
  }, []);

  const isTextCandidate = useCallback(
    (el: Element) => {
      if (!(el instanceof HTMLElement)) return false;
      if (!el.matches("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption")) return false;
      if (el.closest("nav,header,footer,a,button,[role='navigation']")) return false;
      const text = normalizeEditableText(el.textContent ?? "");
      return text.length > 0;
    },
    [normalizeEditableText],
  );

  const markIframeEditables = useCallback(
    (doc: Document) => {
      let sectionCount = 0;
      let textIndex = 0;
      let imageIndex = 0;
      clearSelectedTextHighlight(doc);
      for (const section of Array.from(doc.querySelectorAll("[data-portal-section-key]"))) {
        sectionCount += 1;
        for (const node of Array.from(section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption"))) {
          if (!isTextCandidate(node)) continue;
          const el = node as HTMLElement;
          el.setAttribute("data-portal-editable", "text");
          el.setAttribute("data-editable", "text");
          el.setAttribute("data-portal-text-id", `text-${textIndex++}`);
        }
        for (const node of Array.from(section.querySelectorAll("img"))) {
          const img = node as HTMLImageElement;
          if (img.closest("a,button,nav,header,[role='navigation']")) continue;
          img.setAttribute("data-portal-editable", "image");
          img.setAttribute("data-editable", "image");
          img.setAttribute("data-portal-image-id", `image-${imageIndex++}`);
        }
      }
      setScanStats({ sections: sectionCount, text: textIndex, images: imageIndex });
      return { sections: sectionCount, text: textIndex, images: imageIndex };
    },
    [clearSelectedTextHighlight, isTextCandidate],
  );

  const extractSnapshotFromDocument = useCallback((doc: Document) => {
    const sections: SnapshotSection[] = [];
    for (const sectionNode of Array.from(doc.querySelectorAll("[data-portal-section-key]"))) {
      if (!(sectionNode instanceof HTMLElement)) continue;
      const clone = sectionNode.cloneNode(true) as HTMLElement;
      for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
        for (const attr of Array.from(node.attributes)) {
          if (/^data-portal-/.test(attr.name)) node.removeAttribute(attr.name);
        }
        node.removeAttribute("data-editable");
        node.removeAttribute("data-portal-selected");
      }
      sections.push({
        key: sectionNode.getAttribute("data-portal-section-key") ?? "",
        html: clone.innerHTML,
      });
    }
    return sections;
  }, []);

  const bindIframeEditor = useCallback(() => {
    iframeCleanupRef.current?.();
    const doc = iframeRef.current?.contentDocument;
    if (!doc) {
      setScanStats(null);
      setSelectedTextBlock(null);
      return;
    }

    const timeouts: number[] = [];
    const mark = () => markIframeEditables(doc);

    const selectTextBlock = (el: HTMLElement) => {
      clearSelectedTextHighlight(doc);
      el.setAttribute("data-portal-selected", "1");
      const nextText = normalizeEditableText(el.textContent ?? "");
      setPendingImageTarget(null);
      setSelectedTextBlock({
        textId: el.getAttribute("data-portal-text-id") ?? "",
        sectionKey: el.closest("[data-portal-section-key]")?.getAttribute("data-portal-section-key") ?? "",
        tagName: el.tagName.toLowerCase(),
        originalText: nextText,
        draftText: nextText,
      });
      setSaveErr(null);
      setSaveMsg(null);
    };

    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const image = target.closest('img[data-editable="image"]') as HTMLImageElement | null;
      if (image) {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedTextHighlight(doc);
        setSelectedTextBlock(null);
        setPendingImageTarget({
          imageId: image.getAttribute("data-portal-image-id") ?? "",
          sectionKey: image.closest("[data-portal-section-key]")?.getAttribute("data-portal-section-key") ?? "",
          src: image.getAttribute("src") ?? "",
          alt: image.getAttribute("alt") ?? "",
        });
        setSaveErr(null);
        queueMicrotask(() => fileInputRef.current?.click());
        return;
      }
      const text = target.closest('[data-editable="text"]') as HTMLElement | null;
      if (!text) return;
      event.preventDefault();
      event.stopPropagation();
      selectTextBlock(text);
    };

    const observer = new MutationObserver(() => mark());

    doc.addEventListener("click", handleClick, true);
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
      for (const timeout of timeouts) window.clearTimeout(timeout);
    };
  }, [clearSelectedTextHighlight, markIframeEditables, normalizeEditableText]);

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
        setSelectedTextBlock(null);
        setPendingImageTarget(null);
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

  const onSaveSelectedTextBlock = useCallback(() => {
    if (!selectedTextBlock) return;
    const next = normalizeEditableText(selectedTextBlock.draftText);
    const doc = iframeRef.current?.contentDocument;
    const target = doc?.querySelector(`[data-portal-text-id="${selectedTextBlock.textId}"]`) as HTMLElement | null;
    if (!target) {
      setSaveErr("Geselecteerd tekstblok niet gevonden in de preview.");
      return;
    }
    target.textContent = next;
    clearSelectedTextHighlight(doc);
    target.setAttribute("data-portal-selected", "1");
    setSelectedTextBlock({
      ...selectedTextBlock,
      originalText: next,
      draftText: next,
    });
    setDirty(true);
    setSaveErr(null);
    setSaveMsg(null);
  }, [clearSelectedTextHighlight, normalizeEditableText, selectedTextBlock]);

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
        setSaveMsg("Afbeelding vervangen. Sla op als concept om de wijziging te bewaren.");
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
  }, [bindIframeEditor, markIframeEditables]);

  return (
    <div className="relative left-1/2 right-1/2 w-screen max-w-none -translate-x-1/2 px-2 sm:px-4 lg:px-6 xl:px-8">
      <section className="overflow-hidden border-y border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:border">
        <div className="flex flex-col gap-4 px-4 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Visuele website-editor</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Klik op een tekstblok in de preview. Rechts verschijnt dan een echt tekstvak met een opslaan-knop voor
              alleen dat blok. Afbeeldingen vervang je nog steeds door erop te klikken.
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

        <div className="grid gap-4 border-t border-zinc-200 px-2 pb-2 pt-4 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-3 lg:pb-3">
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
              id="site-preview"
              ref={iframeRef}
              title="Klant website editor"
              className="h-[68dvh] min-h-[560px] w-full border-0 bg-white lg:h-[calc(100dvh-16rem)] lg:min-h-[760px]"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              srcDoc={srcDoc}
              onLoad={onIframeLoad}
            />
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/70 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-11rem)] lg:overflow-auto">
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
              <p>Klik op een tekstblok in de preview. Rechts open ik dan alleen dat blok voor bewerken.</p>
              <p>Klik op een foto om een nieuwe afbeelding te uploaden. De verhoudingen van de site blijven staan.</p>
              <p>
                {scanStats
                  ? `Editor-scan: ${scanStats.sections} secties, ${scanStats.text} tekstblokken en ${scanStats.images} afbeeldingen herkend.`
                  : "Editor-scan wordt geladen..."}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white/90 p-3 dark:border-zinc-700 dark:bg-zinc-900/80">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tekstblok bewerken</p>
              {selectedTextBlock ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Geselecteerd: {selectedTextBlock.tagName.toUpperCase()} in {selectedTextBlock.sectionKey}
                  </p>
                  <textarea
                    value={selectedTextBlock.draftText}
                    onChange={(event) =>
                      setSelectedTextBlock((current) =>
                        current ? { ...current, draftText: event.target.value } : current,
                      )
                    }
                    rows={7}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onSaveSelectedTextBlock}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      <Save className="size-4" aria-hidden />
                      Tekstblok opslaan
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTextBlock((current) =>
                          current ? { ...current, draftText: current.originalText } : current,
                        )
                      }
                      className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Herstel blok
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Klik eerst op een tekstblok in de preview.</p>
              )}
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
