/**
 * Who runs SpeakerDesk and which version of the terms/privacy notice is current.
 * Client-safe (no secrets).
 *
 * ⚠ Fill in OPERATOR before launch, and have the texts in /terms and /privacy reviewed by a
 * lawyer. When you change either text materially, bump TERMS_VERSION: signed-in users who
 * accepted an older version are asked to review and accept the new one.
 */
export const TERMS_VERSION = "2026-11-21";

export const OPERATOR = {
  /** Legal name of the company or person operating SpeakerDesk. */
  name: "Rogier Dijkman",
  /** Registered address, and chamber of commerce / company number if applicable. */
  address: "",
  registration: "",
  /** Where people send privacy requests and questions about the terms. */
  contactEmail: "rogierdijkman@hotmail.com",
  /** Law that governs the terms, e.g. "the Netherlands". */
  governingLaw: "The Netherlands",
};

export const LEGAL_UPDATED = "21 November 2026";
