'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, type Department, type Service } from '@/lib/types';

const MAX_BYTES = 10 * 1024 * 1024;

export default function RequestForm({
  services,
  initialDept,
  email,
  userId,
  initialService = '',
  initialDetails = '',
}: {
  services: Service[];
  initialDept: Department;
  email: string;
  userId: string;
  initialService?: string;
  initialDetails?: string;
}) {
  const [dept, setDept] = useState<Department>(initialDept);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; attached: number } | null>(null);

  const visible = services.filter((s) => s.department === dept && s.active);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const oversized = files.find((f) => f.size > MAX_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than 10 MB. Please attach a smaller scan.`);
      return;
    }

    const supabase = createClient();
    setBusy('Filing your request…');

    const { data, error: rpcError } = await supabase.rpc('submit_request', {
      dept,
      p_service: Number(fd.get('service_id')),
      p_details: String(fd.get('details') ?? ''),
      p_email: String(fd.get('email') ?? ''),
      p_phone: String(fd.get('phone') ?? '') || null,
      p_when: String(fd.get('preferred_at') ?? '') || null,
    });

    if (rpcError || !data) {
      setBusy('');
      setError(rpcError?.message ?? 'Could not file the request.');
      return;
    }

    const req = data as { id: string; reference: string };
    let attached = 0;

    // Files go straight from the browser to Supabase Storage. Routing them
    // through a Server Action would spend Vercel function time on bytes that
    // never need to touch our server, and would run into the body size limit.
    for (const [i, file] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const path = `${userId}/${req.id}/${file.name}`;

      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, file, { upsert: true });

      if (upErr) {
        setError(
          `Request ${req.reference} was filed, but ${file.name} failed to upload: ${upErr.message}`,
        );
        continue;
      }

      const { error: linkErr } = await supabase.rpc('attach_to_request', {
        p_request: req.id,
        p_path: path,
        p_name: file.name,
        p_size: file.size,
      });
      if (!linkErr) attached += 1;
    }

    setBusy('');
    setDone({ reference: req.reference, attached });
  }

  if (done) {
    return (
      <div className="card stack">
        <span className="label">Request filed</span>
        <p className="mono" style={{ fontSize: '1.6rem', letterSpacing: '.04em' }}>
          {done.reference}
        </p>
        <p className="muted">
          Keep this reference.{' '}
          {done.attached > 0
            ? `${done.attached} document${done.attached === 1 ? '' : 's'} attached. `
            : ''}
          You will be emailed at each status change.
        </p>
        <div className="row">
          <Link className="btn" href={`/track/${done.reference}`}>Track it</Link>
          <Link className="btn ghost" href={`/queue?dept=${dept}`}>Get a queue number</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <label className="field">
        <span className="label">Department</span>
        <select
          name="department"
          value={dept}
          onChange={(e) => setDept(e.target.value as Department)}
        >
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>

      {visible.length === 0 ? (
        <div className="setup">
          <strong>No services are set up yet.</strong>
          <span className="muted">
            The service list comes from the database. Run{' '}
            <code>supabase/run-all-migrations.sql</code> in the Supabase SQL editor,
            then reload this page.
          </span>
        </div>
      ) : (
        <label className="field">
          <span className="label">Service</span>
          <select name="service_id" required defaultValue={initialService}>
            {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}

      <label className="field">
        <span className="label">Details of your request</span>
        <textarea
          name="details"
          required
          defaultValue={initialDetails}
          placeholder="Purpose, number of copies, name on the record, and anything the office should know."
        />
      </label>

      <label className="field">
        <span className="label">Supporting documents (optional)</span>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <span className="muted" style={{ fontSize: '.82rem' }}>
          Photos or PDFs &mdash; a valid ID, an authorisation letter, a receipt. 10 MB each.
        </span>
        {files.length > 0 && (
          <ul className="filelist">
            {files.map((f) => (
              <li key={f.name}>
                <span className="mono">{f.name}</span>
                <span className="muted"> &middot; {(f.size / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </label>

      <label className="field">
        <span className="label">Preferred date and time (optional)</span>
        <input name="preferred_at" type="datetime-local" />
      </label>

      <div className="grid2">
        <label className="field">
          <span className="label">Contact email</span>
          <input name="email" type="email" required defaultValue={email} />
        </label>
        <label className="field">
          <span className="label">Mobile (optional)</span>
          <input name="phone" inputMode="tel" placeholder="09XX XXX XXXX" />
        </label>
      </div>

      {error && <p className="notice bad">{error}</p>}
      {busy && <p className="notice">{busy}</p>}

      <div className="row">
        <button disabled={busy !== '' || visible.length === 0}>
          {busy ? 'Working…' : 'File request'}
        </button>
      </div>
    </form>
  );
}
