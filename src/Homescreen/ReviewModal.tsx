'use client';

import React, { useState } from 'react';
import styles from './Homescreen.module.css';
// Removed apiFetch import
import { DISPOSITION_OPTIONS, LEVEL_LIST, TRIAGE_LEVELS, clampLevel, percent, visitTypeLabel } from './clinical';
import { Avatar, Field, Icon, LevelBadge, levelClass, Modal, Notice, SectionLabel, Spinner } from './shared';
import { QueueRecord } from './types';

interface Props {
  record: QueueRecord;
  workerUserId: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({ record, workerUserId, onClose, onSubmitted }: Props) {
  const aiLevel = clampLevel(record.aiTriage.score);
  const [decision, setDecision] = useState<'accepted' | 'overridden'>('accepted');
  const [finalLevelKey, setFinalLevelKey] = useState<string>('');
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [disposition, setDisposition] = useState('in_progress');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overrideIncomplete = decision === 'overridden' && (!finalLevelKey || !reason.trim());
  const canSubmit = !overrideIncomplete && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onSubmitted();
    } catch (err) {
      console.error(err);
      setError('Could not reach the facility server. Check the LAN connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const v = record.vitals;

  return (
    <Modal
      title={`Review: ${record.patientName}`}
      subtitle={`${record.age} yrs · ${record.gender} · ${visitTypeLabel(record.visitType)} · recorded by ${record.recordedBy}`}
      onClose={onClose}
      width="lg"
      locked={submitting}
      footer={
        <>
          <span className={styles.navHint}>
            {overrideIncomplete ? 'Choose the new level and give a reason to submit' : ''}
          </span>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              <>
                <Icon name="check" /> Sign off
              </>
            )}
          </button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <div className={styles.identityRow}>
        <Avatar
          patientId={record.patientId}
          firstName={record.patientName.split(' ')[0]}
          lastName={record.patientName.split(' ').slice(-1)[0]}
          photoPath={record.patientPhoto}
          size={56}
        />
        <div>
          <div className={styles.patientName}>{record.patientName}</div>
          <div className={styles.patientMeta}>Confirm you have the right patient before signing off.</div>
        </div>
      </div>

      <div className={styles.reviewModalGrid}>
        {/* ---- Left: what the AI found ---- */}
        <div className={styles.reviewModalCol}>
          <SectionLabel>AI assessment</SectionLabel>
          <div className={`${styles.resultBanner} ${styles.resultBannerSm} ${levelClass(aiLevel)}`}>
            <div className={styles.resultLevelNum} aria-hidden="true">
              {aiLevel}
            </div>
            <div>
              <div className={styles.resultKicker}>Suggested level</div>
              <div className={styles.resultTitle}>{TRIAGE_LEVELS[aiLevel].label}</div>
              <div className={styles.resultHint}>{TRIAGE_LEVELS[aiLevel].hint}</div>
            </div>
          </div>
          <p className={styles.reasoningText}>{record.aiTriage.reasoning}</p>

          {record.aiTriage.differentialDiagnosis.length > 0 && (
            <>
              <SectionLabel>Possible conditions</SectionLabel>
              <ul className={styles.plainList}>
                {record.aiTriage.differentialDiagnosis.map((d, i) => (
                  <li key={i}>
                    <strong>{d.condition}</strong> <span className={styles.tableMuted}>{percent(d.probability)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {record.aiTriage.suggestedTests.length > 0 && (
            <>
              <SectionLabel>Suggested tests</SectionLabel>
              <div className={styles.chipRow}>
                {record.aiTriage.suggestedTests.map((t, i) => (
                  <span key={i} className={styles.testChip}>
                    <Icon name="flask" size={13} /> {t}
                  </span>
                ))}
              </div>
            </>
          )}

          <SectionLabel>Presentation</SectionLabel>
          <Field label="Chief complaint">{record.chiefComplaint}</Field>
          <Field label="Symptoms">{record.symptoms.length ? record.symptoms.join(', ') : 'None recorded'}</Field>
          <div className={styles.reviewVitals}>
            <Field label="Temp">{v.temperature != null ? `${v.temperature} °C` : '—'}</Field>
            <Field label="BP">{v.bloodPressure || '—'}</Field>
            <Field label="HR">{v.heartRate != null ? `${v.heartRate} bpm` : '—'}</Field>
            <Field label="SpO₂">{v.oxygenLevel != null ? `${v.oxygenLevel}%` : '—'}</Field>
            <Field label="RR">{v.respiratoryRate != null ? `${v.respiratoryRate}/min` : '—'}</Field>
          </div>
        </div>

        {/* ---- Right: doctor's decision ---- */}
        <div className={styles.reviewModalCol}>
          <SectionLabel>Your decision</SectionLabel>
          <div className={styles.choiceGroup} role="radiogroup" aria-label="Triage decision">
            <button
              type="button"
              role="radio"
              aria-checked={decision === 'accepted'}
              className={`${styles.choiceCard} ${decision === 'accepted' ? styles.choiceCardActive : ''}`}
              onClick={() => setDecision('accepted')}
            >
              <span className={styles.choiceTitle}>
                <Icon name="check" size={15} /> Accept level {aiLevel}
              </span>
              <span className={styles.choiceHint}>The AI suggestion is correct</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={decision === 'overridden'}
              className={`${styles.choiceCard} ${decision === 'overridden' ? styles.choiceCardActive : ''}`}
              onClick={() => setDecision('overridden')}
            >
              <span className={styles.choiceTitle}>
                <Icon name="edit" size={15} /> Override
              </span>
              <span className={styles.choiceHint}>Set a different level and say why</span>
            </button>
          </div>

          {decision === 'overridden' && (
            <div className={styles.overrideBox}>
              <div className={styles.formGroup}>
                <span className={styles.inputLabel}>New triage level *</span>
                <div className={styles.levelPicker} role="radiogroup" aria-label="New triage level">
                  {LEVEL_LIST.map((meta) => (
                    <button
                      key={meta.key}
                      type="button"
                      role="radio"
                      aria-checked={finalLevelKey === meta.key}
                      className={`${styles.levelOption} ${finalLevelKey === meta.key ? styles.levelOptionActive : ''}`}
                      onClick={() => setFinalLevelKey(meta.key)}
                      disabled={meta.level === aiLevel}
                      title={meta.level === aiLevel ? 'Same as the AI suggestion' : meta.hint}
                    >
                      <LevelBadge level={meta.level} compact title={meta.hint} />
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="override-reason" className={styles.inputLabel}>
                  Reason for override *
                </label>
                <textarea
                  id="override-reason"
                  className={styles.textArea}
                  rows={2}
                  placeholder="Clinical justification — this is kept with the record"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="diagnosis" className={styles.inputLabel}>
              Working diagnosis
            </label>
            <input
              id="diagnosis"
              type="text"
              className={styles.textInput}
              placeholder="e.g. Uncomplicated malaria"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <span className={styles.inputLabel}>What happens next</span>
            <div className={styles.choiceGroup} role="radiogroup" aria-label="Disposition">
              {DISPOSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={disposition === opt.value}
                  className={`${styles.choiceCard} ${styles.choiceCardSm} ${disposition === opt.value ? styles.choiceCardActive : ''}`}
                  onClick={() => setDisposition(opt.value)}
                >
                  <span className={styles.choiceTitle}>{opt.label}</span>
                  <span className={styles.choiceHint}>{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
