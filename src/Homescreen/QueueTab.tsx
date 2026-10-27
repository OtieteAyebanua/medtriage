import React, { useEffect, useState } from 'react';
import styles from './Homescreen.module.css';
import { TRIAGE_LEVELS, clampLevel, visitTypeLabel, waitDuration } from './clinical';
import { Avatar, EmptyState, Icon, LevelBadge, Spinner } from './shared';
import { QueueRecord } from './types';
import ReviewModal from './ReviewModal';

interface Props {
  queue: QueueRecord[];
  loading: boolean;
  onRefresh: () => void;
  onReviewed: (record: QueueRecord) => void;
}

export default function QueueTab({ queue, loading, onRefresh, onReviewed }: Props) {
  const [selected, setSelected] = useState<QueueRecord | null>(null);
  // Re-render every minute so wait times stay honest.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const critical = queue.filter((r) => clampLevel(r.aiTriage.score) <= 2).length;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Review queue</h1>
          <p className={styles.pageSubtitle}>
            {queue.length === 0
              ? 'Assessments waiting for a doctor to confirm the triage level and record a diagnosis.'
              : `${queue.length} waiting${critical ? ` · ${critical} at level 1–2` : ''}. Most urgent and longest-waiting first.`}
          </p>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
          {loading ? <Spinner /> : <Icon name="refresh" />} Refresh
        </button>
      </div>

      {queue.length === 0 ? (
        <EmptyState icon="check" title="Queue is clear">
          No patients are waiting for review right now.
        </EmptyState>
      ) : (
        <div className={styles.queueGrid}>
          {queue.map((record) => {
            const level = clampLevel(record.aiTriage.score);
            return (
              <article key={record.recordId} className={`${styles.queueCard} ${level <= 2 ? styles.queueCardCritical : ''}`}>
                <div className={styles.queueCardHeader}>
                  <LevelBadge level={level} />
                  <span className={styles.queueWait} title="Time since triage was recorded">
                    <Icon name="clock" size={13} /> {waitDuration(record.visitDate, now)}
                  </span>
                </div>
                <div className={styles.queueIdentity}>
                  <Avatar
                    patientId={record.patientId}
                    firstName={record.patientName.split(' ')[0]}
                    lastName={record.patientName.split(' ').slice(-1)[0]}
                    photoPath={record.patientPhoto}
                    size={44}
                  />
                  <div>
                    <div className={styles.queuePatientName}>{record.patientName}</div>
                    <div className={styles.patientMeta}>
                      {record.age} yrs · {record.gender} · {visitTypeLabel(record.visitType)}
                    </div>
                  </div>
                </div>
                <p className={styles.queueComplaint}>“{record.chiefComplaint}”</p>
                <div className={styles.queueVitals}>
                  {record.vitals.temperature != null && <span>{record.vitals.temperature} °C</span>}
                  {record.vitals.bloodPressure && <span>{record.vitals.bloodPressure} mmHg</span>}
                  {record.vitals.heartRate != null && <span>{record.vitals.heartRate} bpm</span>}
                  {record.vitals.oxygenLevel != null && <span>SpO₂ {record.vitals.oxygenLevel}%</span>}
                </div>
                <div className={styles.queueCardFooter}>
                  <span className={styles.tableMuted}>{TRIAGE_LEVELS[level].hint}</span>
                  <button type="button" className={styles.btnPrimary} onClick={() => setSelected(record)}>
                    Review <Icon name="arrowRight" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <ReviewModal
          record={selected}
          onClose={() => setSelected(null)}
          onSubmitted={() => {
            const done = selected;
            setSelected(null);
            onReviewed(done);
          }}
        />
      )}
    </div>
  );
}
