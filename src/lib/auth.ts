/**
 * Supabase Auth has no concept of a username -- every account is keyed on an
 * email address. So a short office name is mapped onto a fixed internal
 * domain: typing "registrar" signs in as registrar@school.local.
 *
 * The domain is deliberately not routable. Nothing is ever delivered to it,
 * which is why these accounts have to be created with confirmation already
 * granted rather than by clicking a link in an inbox that does not exist.
 *
 * Anything containing an "@" is left alone, so students and staff who prefer
 * their real email address keep using it.
 */
export const USERNAME_DOMAIN = 'school.local';

export function toEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (!value) return value;
  return value.includes('@') ? value : `${value}@${USERNAME_DOMAIN}`;
}

/** The reverse, for showing someone what they sign in as. */
export function toDisplayName(email: string | null | undefined): string {
  if (!email) return '';
  return email.endsWith(`@${USERNAME_DOMAIN}`)
    ? email.slice(0, -(USERNAME_DOMAIN.length + 1))
    : email;
}

/** Usernames are the local part of an address, so keep them to what that allows. */
export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,30}$/.test(value.trim().toLowerCase());
}
