export type {
  GentrixActor,
  GentrixAnalyticsContext,
  GentrixEventName,
  GentrixRenderSurface,
  GentrixSessionType,
  GentrixScrollDepth,
} from "@/lib/analytics/schema";
export { GENTRIX_EVENT_NAMES } from "@/lib/analytics/schema";
export {
  attachGentrixMainWindowScrollDepth,
  captureGentrixPageview,
  identifyGentrixUser,
  initGentrixAnalytics,
  inferGentrixContextFromPath,
  isGentrixAnalyticsEnabled,
  resetGentrixAnalytics,
  setGentrixPageContext,
  trackGentrixEvent,
} from "@/lib/analytics/gentrix-analytics";
export {
  GENTRIX_IFRAME_ANALYTICS_SOURCE,
  isGentrixIframeToParentMessage,
} from "@/lib/analytics/iframe-messages";
