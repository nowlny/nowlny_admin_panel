/**
 * Carries a message that is safe to show the operator, unlike a raw fetch
 * error. Lives on its own so both the link reader (`menuSource`) and the
 * platform importers (`storefrontAdapters`) can throw it without importing
 * each other.
 */
export class MenuSourceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MenuSourceError";
    this.status = status;
  }
}
