'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mediaUrl, initials, YEAR_LEVELS, type Profile } from '@/lib/profile';
import ImageCropper from './ImageCropper';

const MAX_BYTES = 5 * 1024 * 1024;

export default function ProfileEditor({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    student_no: profile.student_no ?? '',
    program: profile.program ?? '',
    year_level: profile.year_level ?? '',
    contact_number: profile.contact_number ?? '',
    bio: profile.bio ?? '',
  });
  const [avatar, setAvatar] = useState(profile.avatar_path);
  const [banner, setBanner] = useState(profile.banner_path);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  // A picked file is not uploaded as it came off the camera: it goes to the
  // cropper, and what the cropper draws is what is stored.
  const [cropping, setCropping] = useState<{ kind: 'avatar' | 'banner'; file: File } | null>(null);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Chosen, not yet uploaded. The guard is here so a huge file is refused
   *  before the browser tries to decode it into a cropper. */
  function pick(kind: 'avatar' | 'banner', file: File) {
    if (file.size > MAX_BYTES) {
      setMsg({ kind: 'bad', text: `${file.name} is over 5 MB. Please pick a smaller image.` });
      return;
    }
    setMsg(null);
    setCropping({ kind, file });
  }

  async function upload(kind: 'avatar' | 'banner', file: File) {
    setMsg(null);
    setBusy(kind === 'avatar' ? 'Uploading picture…' : 'Uploading banner…');

    const supabase = createClient();
    const ext = (file.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() ?? 'jpg').toLowerCase();
    // Timestamped filename: reusing one path would leave the browser showing
    // the cached old image after a change.
    const path = `${profile.id}/${kind}-${Date.now()}.${ext}`;
    const previous = kind === 'avatar' ? avatar : banner;

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file);
    if (upErr) {
      setBusy('');
      setMsg({ kind: 'bad', text: upErr.message });
      return;
    }

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ [`${kind}_path`]: path })
      .eq('id', profile.id);

    if (dbErr) {
      setBusy('');
      setMsg({ kind: 'bad', text: dbErr.message });
      return;
    }

    if (previous) await supabase.storage.from('avatars').remove([previous]);
    if (kind === 'avatar') setAvatar(path); else setBanner(path);

    setBusy('');
    setMsg({ kind: 'ok', text: kind === 'avatar' ? 'Picture updated.' : 'Banner updated.' });
    router.refresh();
  }

  async function removeMedia(kind: 'avatar' | 'banner') {
    const current = kind === 'avatar' ? avatar : banner;
    if (!current) return;
    setBusy('Removing…');
    const supabase = createClient();
    await supabase.from('profiles').update({ [`${kind}_path`]: null }).eq('id', profile.id);
    await supabase.storage.from('avatars').remove([current]);
    if (kind === 'avatar') setAvatar(null); else setBanner(null);
    setBusy('');
    setMsg({ kind: 'ok', text: 'Removed.' });
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy('Saving…');
    setMsg(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        student_no: form.student_no.trim() || null,
        program: form.program.trim() || null,
        year_level: form.year_level || null,
        contact_number: form.contact_number.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq('id', profile.id);

    setBusy('');
    if (error) {
      setMsg({
        kind: 'bad',
        text: error.code === '23505'
          ? 'That student number is already registered to another account.'
          : error.message,
      });
      return;
    }
    setMsg({ kind: 'ok', text: 'Profile saved.' });
    router.refresh();
  }

  const avatarUrl = mediaUrl(avatar);
  const bannerUrl = mediaUrl(banner);

  return (
    <div className="stack">
      <div className="profile-hero">
        <div
          className={`profile-banner${bannerUrl ? '' : ' empty'}`}
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
        >
          <div className="profile-banner-actions">
            <button
              type="button"
              className="ghost tiny"
              onClick={() => bannerInput.current?.click()}
              disabled={busy !== ''}
            >
              {banner ? 'Change banner' : 'Add banner'}
            </button>
            {banner && (
              <button
                type="button"
                className="ghost tiny"
                onClick={() => removeMedia('banner')}
                disabled={busy !== ''}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="profile-idrow">
          <button
            type="button"
            className="profile-avatar-btn"
            onClick={() => avatarInput.current?.click()}
            disabled={busy !== ''}
            title="Change profile picture"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="profile-avatar" />
            ) : (
              <span className="profile-avatar placeholder">
                {initials(form.full_name, email)}
              </span>
            )}
            <span className="profile-avatar-edit" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" />
              </svg>
            </span>
          </button>

          <div className="profile-idtext">
            <strong>{form.full_name || 'Your name'}</strong>
            <span className="muted">{email}</span>
            {avatar && (
              <button
                type="button"
                className="linky"
                onClick={() => removeMedia('avatar')}
                disabled={busy !== ''}
              >
                Remove picture
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick('avatar', f);
          e.target.value = '';
        }}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick('banner', f);
          e.target.value = '';
        }}
      />

      {cropping && (
        <ImageCropper
          file={cropping.file}
          kind={cropping.kind}
          onCancel={() => setCropping(null)}
          onDone={(cropped) => {
            const kind = cropping.kind;
            setCropping(null);
            upload(kind, cropped);
          }}
        />
      )}

      {busy && <p className="notice">{busy}</p>}
      {msg && <p className={`notice ${msg.kind === 'bad' ? 'bad' : 'good'}`}>{msg.text}</p>}

      <form onSubmit={save} className="card stack">
        <h2>Details</h2>

        <label className="field">
          <span className="label">Full name</span>
          <input value={form.full_name} onChange={set('full_name')} required />
        </label>

        <div className="grid2">
          <label className="field">
            <span className="label">Student or employee number</span>
            <input
              value={form.student_no}
              onChange={set('student_no')}
              placeholder="2022-00123"
              className="mono"
            />
          </label>
          <label className="field">
            <span className="label">Mobile number</span>
            <input
              value={form.contact_number}
              onChange={set('contact_number')}
              inputMode="tel"
              placeholder="09XX XXX XXXX"
            />
          </label>
        </div>

        <div className="grid2">
          <label className="field">
            <span className="label">Program or department</span>
            <input
              value={form.program}
              onChange={set('program')}
              placeholder="BS Information Technology"
            />
          </label>
          <label className="field">
            <span className="label">Year level</span>
            <select value={form.year_level} onChange={set('year_level')}>
              <option value="">Not set</option>
              {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="label">About you</span>
          <textarea
            value={form.bio}
            onChange={set('bio')}
            maxLength={280}
            placeholder="Anything the office should know — an authorised representative, a preferred pickup time."
            style={{ minHeight: '5rem' }}
          />
          <span className="muted" style={{ fontSize: '.78rem' }}>
            {form.bio.length}/280
          </span>
        </label>

        <div className="row">
          <button disabled={busy !== ''}>{busy ? 'Working…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
