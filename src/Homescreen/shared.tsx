import React, { useEffect, useRef } from 'react';
import styles from './Homescreen.module.css';
import { clampLevel, initials, photoUrl, TRIAGE_LEVELS, VitalStatus } from './clinical';
import { ToastMessage } from './types';

/* ---------------- Icons (inline SVG so they render the same everywhere) ---------------- */

const ICON_PATHS: Record<string, React.ReactNode> = {
  stethoscope: (
    <>
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15v-4" />
      <path d="M12 15V7" />
      <path d="M17 15v-6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  flask: (
    <>
      <path d="M10 2v7.31" />
      <path d="M14 9.3V1.99" />
      <path d="M8.5 2h7" />
      <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
      <path d="M5.52 16h12.96" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  eye: (
    <>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
};

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ---------------- Avatar ---------------- */

const AVATAR_HUES = [174, 200, 260, 20, 320, 140, 40];

/**
 * Patient photo with an initials fallback. Colour is derived from the ID so the
 * same patient always gets the same colour, which helps recognition in lists.
 */
export function Avatar({
  patientId,
  firstName,
  lastName,
  photoPath,
  size = 40,
  className,
}: {
  patientId: number;
  firstName?: string | null;
  lastName?: string | null;
  photoPath?: string | null;
  size?: number;
  className?: string;
}) {
  // Remember which URL failed; a new upload changes the URL and so gets a fresh chance to load.
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  const url = photoUrl(patientId, photoPath);
  const broken = url !== null && brokenUrl === url;
  const hue = AVATAR_HUES[patientId % AVATAR_HUES.length];
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  const name = [firstName, lastName].filter(Boolean).join(' ');

  if (url && !broken) {
    return (
      <span className={`${styles.avatar} ${className ?? ''}`} style={style}>
        <img src={url} alt={name ? `Photo of ${name}` : 'Patient photo'} onError={() => setBrokenUrl(url)} />
      </span>
    );
  }
  return (
    <span
      className={`${styles.avatar} ${styles.avatarInitials} ${className ?? ''}`}
      style={{ ...style, background: `hsl(${hue} 45% 90%)`, color: `hsl(${hue} 45% 30%)` }}
      aria-label={name ? `${name} (no photo)` : 'No photo'}
      role="img"
    >
      {initials(firstName, lastName)}
    </span>
  );
}

/* ---------------- Badges ---------------- */

const LEVEL_CLASS: Record<number, string> = {
  1: styles.level1,
  2: styles.level2,
  3: styles.level3,
  4: styles.level4,
  5: styles.level5,
};

export function levelClass(level: unknown) {
  return LEVEL_CLASS[clampLevel(level)];
}

/** "Level 1 · Immediate" pill. `compact` shows just "L1 Immediate". */
export function LevelBadge({ level, compact, title }: { level: unknown; compact?: boolean; title?: string }) {
  const n = clampLevel(level);
  const meta = TRIAGE_LEVELS[n];
  return (
    <span className={`${styles.levelBadge} ${levelClass(n)}`} title={title ?? meta.hint}>
      <span className={styles.levelBadgeNum}>{compact ? `L${n}` : `Level ${n}`}</span>
      <span aria-hidden="true">·</span>
      <span>{meta.label}</span>
    </span>
  );
}

const VITAL_STATUS_CLASS: Record<VitalStatus['kind'], string> = {
  empty: styles.vitalEmpty,
  normal: styles.vitalNormal,
  warning: styles.vitalWarning,
  danger: styles.vitalDanger,
  invalid: styles.vitalDanger,
};

export function VitalStatusPill({ status }: { status: VitalStatus }) {
  return <span className={`${styles.vitalStatus} ${VITAL_STATUS_CLASS[status.kind]}`}>{status.label}</span>;
}

/* ---------------- Buttons ---------------- */

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />;
}

/* ---------------- Notices ---------------- */

export function Notice({
  kind,
  children,
  role,
}: {
  kind: 'error' | 'info' | 'success' | 'warning';
  children: React.ReactNode;
  role?: 'alert' | 'status';
}) {
  const cls =
    kind === 'error'
      ? styles.noticeError
      : kind === 'success'
        ? styles.noticeSuccess
        : kind === 'warning'
          ? styles.noticeWarning
          : styles.noticeInfo;
  const icon: IconName = kind === 'error' || kind === 'warning' ? 'alert' : kind === 'success' ? 'check' : 'info';
  return (
    <div className={`${styles.notice} ${cls}`} role={role ?? (kind === 'error' ? 'alert' : 'status')}>
      <Icon name={icon} size={16} className={styles.noticeIcon} />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>
        <Icon name={icon} size={26} />
      </div>
      <h3 className={styles.emptyStateTitle}>{title}</h3>
      {children && <p className={styles.emptyStateText}>{children}</p>}
      {action && <div className={styles.emptyStateAction}>{action}</div>}
    </div>
  );
}

/* ---------------- Modal ---------------- */

interface ModalProps {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg';
  /** Ignore Escape/backdrop while something is in flight */
  locked?: boolean;
}

export function Modal({ title, subtitle, onClose, children, footer, width = 'md', locked }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog so keyboard users land in the right place.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-modal-close])',
    );
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, locked]);

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.modal} ${width === 'lg' ? styles.modalLg : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id={titleId} className={styles.modalTitle}>
              {title}
            </h2>
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            data-modal-close
            disabled={locked}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- Toasts ---------------- */

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className={styles.toastStack} aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${
            t.kind === 'error' ? styles.toastError : t.kind === 'success' ? styles.toastSuccess : ''
          }`}
        >
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} size={16} />
          <span className={styles.toastText}>{t.text}</span>
          <button type="button" className={styles.toastClose} onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Small layout helpers ---------------- */

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={styles.sectionLabelRow}>
      <h4 className={styles.sectionLabel}>{children}</h4>
      {right}
    </div>
  );
}

/** Label + value pair used in profile pills and review summaries. */
export function Field({ label, children, alert }: { label: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.fieldValue} ${alert ? styles.fieldValueAlert : ''}`}>{children}</span>
    </div>
  );
}
