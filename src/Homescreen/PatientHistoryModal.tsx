'use client';

import React, { useEffect, useState } from 'react';
import styles from './Homescreen.module.css';
import { apiFetch } from './api';
import {
  formatDate,
  formatDateTime,
  fullName,
  hasAllergies,
  levelFromKey,
  percent,
  RECORD_STATUS_LABEL,
  relativeTime,
  visitTypeLabel,
} from './clinical';
import { Avatar, EmptyState, Field, Icon, LevelBadge, Modal, Notice, SectionLabel, Spinner } from './shared';
import { PatientHistory, PatientVisit } from './types';

interface Props {
  patientId: number;
  onClose: () => void;
  onStartTriage?: (patientId: number) => void;
}

/** "View Patient History" use case — every past assessment for one patient. */
export default function PatientHistoryModal({ patientId, onClose, onStartTriage }: Props) {
  const [data, setData] = useState<PatientHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/patients/${patientId}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setData(json);
          setOpenId(json.visits?.[0]?.record_id ?? null);
        } else {
          setError(json.error || 'Could not load patient history.');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Could not reach the facility server.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const p = data?.patient;

  return (
    <Modal
      title={p ? fullName(p) : 'Patient history'}
      subtitle={
        p
          ? `${p.age} yrs · ${p.gender} · ${p.blood_type} · ID #${p.patient_id}${hasAllergies(p) ? ` · Allergies: ${p.allergies}` : ''}`
          : undefined
      }
      onClose={onClose}
      width="lg"
      footer={
        <>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
          {onStartTriage && (
            <button type="button" className={styles.btnPrimary} onClick={() => onStartTriage(patientId)}>
              Start new triage <Icon name="arrowRight" />
            </button>
          )}
        </>
      }
    >
      {error ? (
        <Notice kind="error">{error}</Notice>
      ) : !data ? (
        <div className={styles.loadingRow}>
          <Spinner /> Loading history…
        </div>
      ) : data.visits.length === 0 ? (
        <EmptyState icon="clipboard" title="No previous visits">
          This patient has not been triaged before.
        </EmptyState>
      ) : (
        <>
          {p && (
            <div className={styles.identityRow}>
              <Avatar patientId={p.patient_id} firstName={p.first_name} lastName={p.last_name} photoPath={p.photo_path} size={64} />
              <div>
                <div className={styles.patientName}>{fullName(p)}</div>
                <div className={styles.patientMeta}>Registered {formatDate((p as { created_at?: string }).created_at)}</div>
              </div>
            </div>
          )}
          {p && (p.chronic_conditions || hasAllergies(p)) && (
            <div className={styles.profilePill}>
              <Field label="Allergies" alert={hasAllergies(p)}>
                {hasAllergies(p) ? p.allergies : 'None recorded'}
              </Field>
              <Field label="Chronic conditions">{p.chronic_conditions || 'None recorded'}</Field>
            </div>
          )}
          <SectionLabel>
            {data.visits.length} visit{data.visits.length === 1 ? '' : 's'} · most recent first
          </SectionLabel>
          <ol className={styles.timeline}>
            {data.visits.map((v) => (
              <VisitItem key={v.record_id} visit={v} open={openId === v.record_id} onToggle={() => setOpenId(openId === v.record_id ? null : v.record_id)} />
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}

function VisitItem({ visit: v, open, onToggle }: { visit: PatientVisit; open: boolean; onToggle: () => void }) {
  const aiLevel = v.ai.urgency_score;
  const finalLevel = v.review.final_triage_level ? levelFromKey(v.review.final_triage_level) : aiLevel;
  const overridden = v.review.override_status === 'overridden';
  const pending = v.review.override_status === 'pending';

  return (
    <li className={`${styles.timelineItem} ${v.is_current ? styles.timelineItemCurrent : ''}`}>
      <button type="button" className={styles.timelineHead} onClick={onToggle} aria-expanded={open}>
        <div className={styles.timelineWhen}>
          <strong>{formatDate(v.visit_date)}</strong>
          <span className={styles.tableMuted}>{relativeTime(v.visit_date)}</span>
        </div>
        <div className={styles.timelineMain}>
          <div className={styles.timelineBadges}>
            <LevelBadge level={finalLevel} />
            {overridden && (
              <span className={styles.tableMuted} title={v.review.override_reason ?? ''}>
                AI said L{aiLevel}
              </span>
            )}
            <span className={`${styles.statusPill} ${pending ? styles.statusPending : styles.statusDone}`}>
              {pending ? 'Awaiting review' : (RECORD_STATUS_LABEL[v.status] ?? v.status)}
            </span>
            {v.is_current && <span className={styles.chipSm}>Current</span>}
          </div>
          <div className={styles.timelineComplaint}>“{v.chief_complaint}”</div>
          <div className={styles.tableMuted}>
            {visitTypeLabel(v.visit_type)}
            {v.review.diagnosis ? ` · Diagnosis: ${v.review.diagnosis}` : pending ? '' : ' · No diagnosis recorded'}
            {v.recorded_by ? ` · by ${v.recorded_by.first_name} ${v.recorded_by.last_name}` : ''}
          </div>
        </div>
        <Icon name="arrowRight" size={16} className={`${styles.timelineChevron} ${open ? styles.timelineChevronOpen : ''}`} />
      </button>

      {open && (
        <div className={styles.timelineBody}>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewCard}>
              <SectionLabel>Vitals</SectionLabel>
              <div className={styles.reviewVitals}>
                <Field label="Temp">{v.vitals.temperature != null ? `${v.vitals.temperature} °C` : '—'}</Field>
                <Field label="BP">{v.vitals.blood_pressure || '—'}</Field>
                <Field label="HR">{v.vitals.heart_rate != null ? `${v.vitals.heart_rate} bpm` : '—'}</Field>
                <Field label="SpO₂">{v.vitals.oxygen_level != null ? `${v.vitals.oxygen_level}%` : '—'}</Field>
                <Field label="RR">{v.vitals.respiratory_rate != null ? `${v.vitals.respiratory_rate}/min` : '—'}</Field>
              </div>
              <SectionLabel>Symptoms</SectionLabel>
              {v.symptoms.length === 0 ? (
                <p className={styles.mutedText}>None recorded</p>
              ) : (
                <ul className={styles.plainList}>
                  {v.symptoms.map((s) => (
                    <li key={s.symptom_id}>
                      <strong>{s.name}</strong> · {s.severity} · {s.duration}
                      {s.notes && <span className={styles.tableMuted}> — {s.notes}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.reviewCard}>
              <SectionLabel>AI assessment</SectionLabel>
              <p className={styles.reasoningText}>{v.ai.reasoning}</p>
              {v.ai.differential_diagnosis.length > 0 && (
                <ul className={styles.plainList} style={{ marginTop: '0.6rem' }}>
                  {v.ai.differential_diagnosis.map((d, i) => (
                    <li key={i}>
                      {d.condition} <span className={styles.tableMuted}>{percent(d.probability)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!pending && (
                <>
                  <SectionLabel>Doctor review</SectionLabel>
                  <Field label="Decision">
                    {overridden ? `Overridden to Level ${finalLevel}` : `Accepted Level ${aiLevel}`}
                    {v.treated_by ? ` · ${v.treated_by.position === 'doctor' ? 'Dr. ' : ''}${v.treated_by.first_name} ${v.treated_by.last_name}` : ''}
                  </Field>
                  {overridden && v.review.override_reason && <Field label="Reason">{v.review.override_reason}</Field>}
                  <Field label="Diagnosis">{v.review.diagnosis || '—'}</Field>
                  <Field label="Outcome">{RECORD_STATUS_LABEL[v.status] ?? v.status}</Field>
                </>
              )}
            </div>
          </div>
          <div className={styles.tableMuted} style={{ marginTop: '0.5rem' }}>
            Record #{v.record_id} · {formatDateTime(v.visit_date)}
          </div>
        </div>
      )}
    </li>
  );
}
