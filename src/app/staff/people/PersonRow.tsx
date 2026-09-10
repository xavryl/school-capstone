'use client';

import { useState, useTransition } from 'react';
import { setStaffRole } from './actions';
import type { Department } from '@/lib/types';

export type Person = {
  id: string;
  full_name: string;
  student_no: string | null;
  department: Department | null;
  role: 'staff' | 'head';
  is_admin: boolean;
  isSelf: boolean;
};

export default function PersonRow({ person }: { person: Person }) {
  const [dept, setDept] = useState<Department | 'none'>(person.department ?? 'none');
  const [role, setRole] = useState<'staff' | 'head'>(person.role);
  const [isAdmin, setIsAdmin] = useState(person.is_admin);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const changed =
    dept !== (person.department ?? 'none') ||
    role !== person.role ||
    isAdmin !== person.is_admin;

  return (
    <tr>
      <td>
        <strong>{person.full_name || 'No name set'}</strong>
        {person.isSelf && <span className="pill on" style={{ marginLeft: '.5rem' }}>You</span>}
        {person.student_no && (
          <div className="muted mono" style={{ fontSize: '.85rem' }}>{person.student_no}</div>
        )}
        {msg && <div className="muted" style={{ fontSize: '.85rem', color: 'var(--bad)' }}>{msg}</div>}
      </td>

      <td>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value as Department | 'none')}
          style={{ minWidth: '9rem' }}
        >
          <option value="none">Not staff</option>
          <option value="registrar">Registrar</option>
          <option value="treasury">Treasury</option>
        </select>
      </td>

      <td>
        <div className="stack" style={{ gap: '.4rem' }}>
          <select
            value={role}
            disabled={dept === 'none'}
            onChange={(e) => setRole(e.target.value as 'staff' | 'head')}
            style={{ minWidth: '9rem' }}
          >
            <option value="staff">Office staff</option>
            <option value="head">Office administrator</option>
          </select>

          <label className="row" style={{ gap: '.45rem', flexWrap: 'nowrap' }}>
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={dept === 'none'}
              onChange={(e) => setIsAdmin(e.target.checked)}
              style={{ width: '1.15rem', height: '1.15rem', minHeight: 0 }}
            />
            <span className="muted" style={{ fontSize: '.92rem' }}>
              System administrator
            </span>
          </label>
        </div>
      </td>

      <td>
        <button
          className="ghost tiny"
          disabled={pending || !changed}
          onClick={() =>
            start(async () => {
              const r = await setStaffRole(person.id, dept, role, isAdmin);
              setMsg(r.error ?? null);
            })
          }
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
