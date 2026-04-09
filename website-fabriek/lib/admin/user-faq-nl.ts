import raw from "./user-faq-nl.json";

export type UserFaqItem = {
  question: string;
  answer: string;
};

export const USER_FAQ_NL = raw as UserFaqItem[];

export const USER_FAQ_PDF_PATH = "/docs/veelgestelde-vragen-website-fabriek.pdf";
