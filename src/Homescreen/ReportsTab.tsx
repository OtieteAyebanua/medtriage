'use client';

import React from 'react';
import styles from './Homescreen.module.css';
import { formatDateTime, LEVEL_LIST, levelFromKey, RECORD_STATUS_LABEL, relativeTime } from './clinical';
import { EmptyState, Icon, LevelBadge, levelClass, Spinner } from './shared';
import { WardReport } from './types';

interface Props {
  report: WardReport | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function ReportsTab({ report, loading, onRefresh }: Props) {
  const total = report?.total_records ?? 0;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Ward overview</h1>
          <p className={styles.pageSubtitle}>How many patients have been triaged at each level, and the latest activity.</p>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
          {loading ? <Spinner /> : <Icon name="refresh" />} Refresh
        </button>
      </div>

      <div className={styles.metricsRow}>
        <div className={styles.metricBox}>
          <div className={styles.metricLabel}>Total triaged</div>
          <div className={styles.metricValue}>{report ? total : '—'}</div>
          <div className={styles.metricHint}>all time</div>
        </div>
        {LEVEL_LIST.map((meta) => {
          const count = report?.acuity_distribution?.[meta.level] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={meta.level} className={`${styles.metricBox} ${styles.metricBoxLevel} ${levelClass(meta.level)}`}>
              <div className={styles.metricLabel}>
                Level {meta.level} · {meta.label}
              </div>
              <div className={styles.metricValue}>{report ? count : '—'}</div>
              <div className={styles.metricHint}>{report ? `${share}% of visits` : meta.hint}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.reviewStatsCard}>
        <div className={styles.reviewStatsHead}>
          <div>
            <h2 className={styles.cardTitle}>Doctor review</h2>
            <p className={styles.cardDesc}>How often doctors agree with the AI triage level — the key governance signal for the model.</p>
          </div>
        </div>
        <div className={styles.reviewStatsRow}>
          <div className={styles.metricBox}>
            <div className={styles.metricLabel}>Awaiting review</div>
            <div className={`${styles.metricValue} ${report?.awaiting_review ? styles.textWarn : ''}`}>
              {report ? report.awaiting_review : '—'}
            </div>
            <div className={styles.metricHint}>in the queue now</div>
          </div>
          <div className={styles.metricBox}>
            <div className={styles.metricLabel}>Reviewed</div>
            <div className={styles.metricValue}>{report ? report.review_stats.reviewed : '—'}</div>
            <div className={styles.metricHint}>signed off by a doctor</div>
          </div>
          <div className={styles.metricBox}>
            <div className={styles.metricLabel}>Accepted</div>
            <div className={`${styles.metricValue} ${styles.textOk}`}>{report ? report.review_stats.accepted : '—'}</div>
            <div className={styles.metricHint}>AI level kept</div>
          </div>
          <div className={styles.metricBox}>
            <div className={styles.metricLabel}>Overridden</div>
            <div className={`${styles.metricValue} ${report?.review_stats.overridden ? styles.textDanger : ''}`}>
              {report ? report.review_stats.overridden : '—'}
            </div>
            <div className={styles.metricHint}>doctor changed the level</div>
          </div>
          <div className={`${styles.metricBox} ${styles.metricBoxAccent}`}>
            <div className={styles.metricLabel}>Agreement rate</div>
            <div className={styles.metricValue}>
              {report && report.review_stats.agreement_rate !== null ? `${report.review_stats.agreement_rate}%` : '—'}
            </div>
            <div className={styles.metricHint}>
              {report && report.review_stats.agreement_rate === null ? 'no reviews yet' : 'accepted ÷ reviewed'}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <div>
            <h2 className={styles.cardTitle}>Recent triage activity</h2>
            <p className={styles.cardDesc}>The 10 most recent assessments recorded at this facility.</p>
          </div>
        </div>

        {!report && loading ? (
          <EmptyState icon="chart" title="Loading ward data…" />
        ) : !report?.recent_records?.length ? (
          <EmptyState icon="chart" title="No triage records yet">
            Completed assessments will appear here.
          </EmptyState>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Triage level</th>
                  <th>Chief complaint</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {report.recent_records.map((r) => {
                  const aiLevel = r.ai_urgency_score ?? levelFromKey(r.ai_triage_level);
                  const finalLevel = r.final_triage_level ? levelFromKey(r.final_triage_level) : aiLevel;
                  const overridden = r.override_status === 'overridden' && finalLevel !== aiLevel;
                  return (
                    <tr key={r.record_id}>
                      <td>
                        <div className={styles.tableStrong}>
                          {r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : `Patient #${r.patient_id}`}
                        </div>
                        <div className={styles.tableMuted}>Record #{r.record_id}</div>
                      </td>
                      <td>
                        <LevelBadge level={finalLevel} compact />
                        {overridden && (
                          <div className={styles.tableMuted} title="Doctor changed the AI suggestion">
                            AI suggested L{aiLevel}
                          </div>
                        )}
                      </td>
                      <td className={styles.tableClamp} title={r.chief_complaint}>
                        {r.chief_complaint || '—'}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            r.status === 'triaged' || r.status === 'waiting' ? styles.statusPending : styles.statusDone
                          }`}
                        >
                          {RECORD_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td>{r.recorder ? `${r.recorder.first_name} ${r.recorder.last_name}` : 'Staff'}</td>
                      <td className={styles.tableMuted} title={formatDateTime(r.visit_date)}>
                        {relativeTime(r.visit_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
