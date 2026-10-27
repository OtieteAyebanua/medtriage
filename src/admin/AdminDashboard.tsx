import React, { useCallback, useEffect, useState } from 'react';
import hs from '../Homescreen/Homescreen.module.css';
import styles from './Admin.module.css';
import { EmptyState, Icon, Modal, Spinner, ToastStack } from '../Homescreen/shared';
import { ToastMessage } from '../Homescreen/types';
import { errorMessage, listPractitioners, Practitioner, setPractitionerActive } from '@/api';
import PractitionerModal from './PractitionerModal';
import {
  formatDay,
  LICENSE_WARNING_DAYS,
  licenseState,
  matchesPractitioner,
  POSITIONS,
  positionLabel,
  practitionerName,
} from './practitioners';

type StatusFilter = 'active' | 'inactive' | 'all';

interface Props {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: Props) {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [positionFilter, setPositionFilter] = useState('');

  // null = closed; 'new' = add form; otherwise the practitioner being edited
  const [editing, setEditing] = useState<Practitioner | 'new' | null>(null);
  const [statusTarget, setStatusTarget] = useState<Practitioner | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPractitioners(await listPractitioners());
    } catch (err) {
      toast('error', errorMessage(err, 'Could not load practitioners.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = (saved: Practitioner) =>
    setPractitioners((prev) =>
      prev.some((p) => p.userId === saved.userId) ? prev.map((p) => (p.userId === saved.userId ? saved : p)) : [saved, ...prev],
    );

  const handleSaved = (saved: Practitioner, created: boolean) => {
    upsert(saved);
    setEditing(null);
    toast('success', created ? `${practitionerName(saved)} added. They can now sign in as ${saved.employeeId}.` : `${practitionerName(saved)} updated.`);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      const saved = await setPractitionerActive(statusTarget.userId, !statusTarget.active);
      upsert(saved);
      toast('success', `${practitionerName(saved)} ${saved.active ? 'reactivated' : 'deactivated'}.`);
      setStatusTarget(null);
    } catch (err) {
      toast('error', errorMessage(err, 'Could not change the account status.'));
    } finally {
      setStatusSaving(false);
    }
  };

  const active = practitioners.filter((p) => p.active);
  const licenseAlerts = active.filter((p) => ['expired', 'expiring'].includes(licenseState(p))).length;
  const filtered = practitioners.filter(
    (p) =>
      (statusFilter === 'all' || p.active === (statusFilter === 'active')) &&
      (!positionFilter || p.position === positionFilter) &&
      matchesPractitioner(p, query),
  );

  return (
    <div className={hs.app}>
      <header className={hs.topHeader}>
        <div className={hs.brandGroup}>
          <span className={hs.brandTitle}>
            MedTriage <span className={hs.brandAccent}>AI</span>
          </span>
          <span className={styles.adminBadge}>Admin console</span>
        </div>
        <div className={hs.userGroup}>
          <button type="button" className={hs.btnSecondary} onClick={onLogout} title="Sign out of the admin console">
            <Icon name="logout" /> <span className={hs.hideOnMobile}>Sign out</span>
          </button>
        </div>
      </header>

      <main className={hs.main}>
        <div className={hs.pageHeader}>
          <div>
            <h1 className={hs.pageTitle}>Practitioners</h1>
            <p className={hs.pageSubtitle}>
              Add medical practitioners after verifying their identity and licence. Only accounts listed here can sign in to
              MedTriage.
            </p>
          </div>
          <button type="button" className={hs.btnPrimary} onClick={() => setEditing('new')}>
            <Icon name="plus" /> Add practitioner
          </button>
        </div>

        <div className={styles.metricsRow}>
          <Metric label="Active accounts" value={active.length} />
          <Metric label="Doctors" value={active.filter((p) => p.position === 'doctor').length} />
          <Metric label="Nurses" value={active.filter((p) => p.position === 'nurse').length} />
          <Metric
            label="Licence alerts"
            value={licenseAlerts}
            hint={`Expired or expiring within ${LICENSE_WARNING_DAYS} days`}
            warn={licenseAlerts > 0}
          />
        </div>

        <div className={hs.tableCard}>
          <div className={styles.filterBar}>
            <div className={`${hs.searchField} ${styles.filterSearch}`}>
              <Icon name="search" size={16} className={hs.searchIcon} />
              <input
                type="search"
                placeholder="Search name, employee ID, email or licence…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={hs.searchInput}
                aria-label="Search practitioners"
              />
            </div>
            <select
              className={`${hs.selectInput} ${styles.filterSelect}`}
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className={hs.segmented} role="radiogroup" aria-label="Account status">
              {(
                [
                  ['active', 'Active'],
                  ['inactive', 'Deactivated'],
                  ['all', 'All'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={statusFilter === value}
                  className={`${hs.segment} ${statusFilter === value ? hs.segmentActive : ''}`}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && practitioners.length === 0 ? (
            <EmptyState icon="users" title="Loading practitioners…" />
          ) : practitioners.length === 0 ? (
            <EmptyState
              icon="users"
              title="No practitioners yet"
              action={
                <button type="button" className={hs.btnPrimary} onClick={() => setEditing('new')}>
                  <Icon name="plus" /> Add the first practitioner
                </button>
              }
            >
              Add the doctors, nurses and other staff who will use MedTriage.
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState icon="search" title="No practitioners match these filters">
              Clear the search or switch the status filter to see more accounts.
            </EmptyState>
          ) : (
            <div className={hs.tableScroll}>
              <table className={hs.dataTable}>
                <thead>
                  <tr>
                    <th>Practitioner</th>
                    <th>Employee ID</th>
                    <th>Role</th>
                    <th>Licence</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.userId} className={p.active ? undefined : styles.rowInactive}>
                      <td>
                        <div className={hs.tableStrong}>{practitionerName(p)}</div>
                        <div className={hs.tableMuted}>{p.email}</div>
                      </td>
                      <td className={styles.mono}>{p.employeeId}</td>
                      <td>
                        <div>{positionLabel(p.position)}</div>
                        {p.department && <div className={hs.tableMuted}>{p.department}</div>}
                      </td>
                      <td>
                        <LicenseCell practitioner={p} />
                      </td>
                      <td>
                        <span className={`${hs.statusPill} ${p.active ? styles.statusActive : hs.statusDone}`}>
                          {p.active ? 'Active' : 'Deactivated'}
                        </span>
                        {p.verifiedAt && <div className={hs.tableMuted}>Verified {formatDay(p.verifiedAt)}</div>}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" className={hs.btnSecondary} onClick={() => setEditing(p)}>
                            <Icon name="edit" /> Edit
                          </button>
                          <button
                            type="button"
                            className={`${hs.btnLink} ${p.active ? hs.btnLinkDanger : ''}`}
                            onClick={() => setStatusTarget(p)}
                          >
                            {p.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editing && (
        <PractitionerModal
          practitioner={editing === 'new' ? null : editing}
          existing={practitioners}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {statusTarget && (
        <Modal
          title={statusTarget.active ? 'Deactivate account?' : 'Reactivate account?'}
          onClose={() => setStatusTarget(null)}
          locked={statusSaving}
          footer={
            <>
              <button type="button" className={hs.btnSecondary} onClick={() => setStatusTarget(null)} disabled={statusSaving}>
                Cancel
              </button>
              <button
                type="button"
                className={statusTarget.active ? hs.btnDanger : hs.btnPrimary}
                onClick={confirmStatusChange}
                disabled={statusSaving}
              >
                {statusSaving && <Spinner />}
                {statusTarget.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </>
          }
        >
          <p className={styles.confirmText}>
            {statusTarget.active ? (
              <>
                <strong>{practitionerName(statusTarget)}</strong> ({statusTarget.employeeId}) will be signed out and won&apos;t be
                able to sign in. Their past triage records are kept.
              </>
            ) : (
              <>
                <strong>{practitionerName(statusTarget)}</strong> ({statusTarget.employeeId}) will be able to sign in again. Check
                that their licence is still current first.
              </>
            )}
          </p>
        </Modal>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

function Metric({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className={`${hs.metricBox} ${warn ? styles.metricWarn : ''}`}>
      <div className={hs.metricLabel}>{label}</div>
      <div className={hs.metricValue}>{value}</div>
      {hint && <div className={hs.metricHint}>{hint}</div>}
    </div>
  );
}

function LicenseCell({ practitioner: p }: { practitioner: Practitioner }) {
  const state = licenseState(p);
  if (state === 'missing') {
    return <span className={hs.tableMuted}>{p.position === 'admin' ? 'Not required' : 'Not on file'}</span>;
  }
  return (
    <>
      <div className={styles.mono}>{p.licenseNumber}</div>
      <div className={`${hs.tableMuted} ${state === 'expired' ? hs.textDanger : state === 'expiring' ? hs.textWarn : ''}`}>
        {state === 'no_expiry'
          ? 'No expiry recorded'
          : state === 'expired'
            ? `Expired ${formatDay(p.licenseExpiry)}`
            : `${state === 'expiring' ? 'Expires' : 'Valid to'} ${formatDay(p.licenseExpiry)}`}
      </div>
    </>
  );
}
