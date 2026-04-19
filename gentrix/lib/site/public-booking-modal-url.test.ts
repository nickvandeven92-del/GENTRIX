import { describe, expect, it } from "vitest";
import { publicBookingIframeSrcFromNavHref } from "@/lib/site/public-booking-modal-url";

describe("publicBookingIframeSrcFromNavHref", () => {
  const origin = "https://www.gentrix.nl";

  it("laat booking-app/book door", () => {
    expect(publicBookingIframeSrcFromNavHref("/booking-app/book/mosham", origin)).toBe(
      "https://www.gentrix.nl/booking-app/book/mosham",
    );
  });

  it("mapt /boek/slug naar booking-app", () => {
    expect(publicBookingIframeSrcFromNavHref("/boek/mosham", origin)).toBe(
      "https://www.gentrix.nl/booking-app/book/mosham",
    );
  });

  it("mapt /boek-venster/slug naar booking-app (geen dubbel frame)", () => {
    expect(publicBookingIframeSrcFromNavHref("/boek-venster/mosham", origin)).toBe(
      "https://www.gentrix.nl/booking-app/book/mosham",
    );
  });

  it("geeft null voor winkel", () => {
    expect(publicBookingIframeSrcFromNavHref("/winkel/mosham", origin)).toBeNull();
  });
});
