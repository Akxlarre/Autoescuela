/**
 * Pure utility functions for email validation.
 */

/** RFC 5322-based regex — covers the vast majority of real-world email addresses. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns true if the email string is a syntactically valid address. */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Returns the email trimmed and lowercased — ready for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
