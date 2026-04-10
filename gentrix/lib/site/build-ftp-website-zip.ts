import JSZip from "jszip";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildStandaloneExportHtmlDocument, STANDALONE_EXPORT_README_NL } from "@/lib/site/build-standalone-export-html";
import { buildTailwindCompiledCssFromIndexHtml } from "@/lib/site/build-tailwind-compiled-css";
import { EXPORT_INTEGRATION_GUIDE_NL } from "@/lib/site/export-integration-guide-nl";
import { bundleRemoteImagesForExport } from "@/lib/site/bundle-export-remote-images";

/**
 * ZIP met index.html + styles.css (Tailwind build) + images/* voor FTP-upload zonder CDN.
 */
export async function buildFtpWebsiteZipBuffer(options: {
  projectRoot: string;
  sections: TailwindSection[];
  config: TailwindPageConfig | null | undefined;
  docTitle: string;
  customCss?: string;
  customJs?: string;
  logoSet?: GeneratedLogoSet | null;
  subfolderSlug: string;
  appointmentsEnabled: boolean;
  webshopEnabled: boolean;
}): Promise<Buffer> {
  const {
    projectRoot,
    sections,
    config,
    docTitle,
    customCss,
    customJs,
    logoSet,
    subfolderSlug,
    appointmentsEnabled,
    webshopEnabled,
  } = options;

  const scanHtml = buildStandaloneExportHtmlDocument(sections, config, docTitle, "local_css", {
    css: customCss,
    js: customJs,
    logoSet,
    forTailwindClassScan: true,
  });
  const stylesCss = await buildTailwindCompiledCssFromIndexHtml(projectRoot, scanHtml);

  let html = buildStandaloneExportHtmlDocument(sections, config, docTitle, "local_css", {
    css: customCss,
    js: customJs,
    logoSet,
    exportPublish: {
      subfolderSlug,
      appointmentsEnabled,
      webshopEnabled,
    },
  });
  const bundled = await bundleRemoteImagesForExport(html);
  html = bundled.html;

  const zip = new JSZip();
  zip.file("index.html", html);
  zip.file("styles.css", stylesCss);
  zip.file("LEES-MIJ.txt", STANDALONE_EXPORT_README_NL);
  zip.file("INTEGRATIE-backend-en-AB.txt", EXPORT_INTEGRATION_GUIDE_NL);

  for (const img of bundled.images) {
    zip.file(img.zipPath, img.data);
  }

  const nodeBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return Buffer.from(nodeBuffer);
}
