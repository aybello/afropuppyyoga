export const LUMA_CALENDAR_EMBED_URL = "https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light";
export const LUMA_CHECKOUT_SCRIPT_URL = "https://embed.lu.ma/checkout-button.js";
export const LUMA_CALENDAR_LOAD_MARGIN = "400px 0px";

export function shouldActivateLumaCalendar(isNearClasses: boolean, requestedByVisitor: boolean) {
  return isNearClasses || requestedByVisitor;
}
