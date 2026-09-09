export type Profile = {
  id: string;
  full_name: string;
  student_no: string | null;
  avatar_path: string | null;
  banner_path: string | null;
  bio: string | null;
  program: string | null;
  year_level: string | null;
  contact_number: string | null;
};

/**
 * The avatars bucket is public, so its objects have a stable URL and need no
 * signing round trip. Paths already carry an upload timestamp, which is what
 * busts the browser cache when someone changes their picture.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

/** Two letters from a name, falling back to the email, for the empty state. */
export function initials(name: string | null, email: string | null): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export const YEAR_LEVELS = [
  '1st year', '2nd year', '3rd year', '4th year', '5th year',
  'Graduate', 'Alumnus', 'Faculty', 'Staff',
];
