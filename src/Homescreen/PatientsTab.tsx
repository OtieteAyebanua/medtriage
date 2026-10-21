'use client';

import React, { useState } from 'react';
import styles from './Homescreen.module.css';
import { ageFrom, formatDate, fullName, hasAllergies, lastVisitSummary, matchesPatient } from './clinical';
import { Avatar, EmptyState, Field, Icon } from './shared';
import PatientPhotoModal from './PatientPhotoModal';
import { PatientItem } from './types';

interface Props {
  patients: PatientItem[];
  loading: boolean;
  onRegister: () => void;
  onStartTriage: (patientId: number) => void;
  onViewHistory: (patientId: number) => void;
  /** Called after a photo is saved or removed, with a message for the toast */
  onPatientUpdated: (patient: PatientItem, message: string) => void;
}

export default function PatientsTab({ patients, loading, onRegister, onStartTriage, onViewHistory, onPatientUpdated }: Props) {
  const [query, setQuery] = useState('');
  const [photoPatient, setPhotoPatient] = useState<PatientItem | null>(null);
  const filtered = patients.filter((p) => matchesPatient(p, query));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Patients</h1>
          <p className={styles.pageSubtitle}>
            {patients.length} registered. Search by name, ID or blood group, then start a triage.
          </p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={onRegister}>
          <Icon name="plus" /> Register patient
        </button>
      </div>

      <div className={styles.searchField}>
        <Icon name="search" size={16} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Search patients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
          aria-label="Search patients"
        />
      </div>

      {loading && patients.length === 0 ? (
        <EmptyState icon="users" title="Loading patients…" />
      ) : patients.length === 0 ? (
        <EmptyState
          icon="users"
          title="No patients yet"
          action={
            <button type="button" className={styles.btnPrimary} onClick={onRegister}>
              <Icon name="plus" /> Register the first patient
            </button>
          }
        >
          Register a patient to begin a triage assessment.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No patients match “${query}”`}
          action={
            <button type="button" className={styles.btnSecondary} onClick={onRegister}>
              <Icon name="plus" /> Register a new patient
            </button>
          }
        >
          Check the spelling, or register them if they are new to the facility.
        </EmptyState>
      ) : (
        <div className={styles.patientGrid}>
          {filtered.map((p) => {
            const age = ageFrom(p.date_of_birth);
            const allergic = hasAllergies(p);
            return (
              <div key={p.patient_id} className={styles.patientCard}>
                <div className={styles.patientCardHeader}>
                  <button
                    type="button"
                    className={styles.avatarButton}
                    onClick={() => setPhotoPatient(p)}
                    title={p.photo_path ? 'Change or remove photo' : 'Add photo'}
                    aria-label={p.photo_path ? `Change or remove photo of ${fullName(p)}` : `Add photo of ${fullName(p)}`}
                  >
                    <Avatar patientId={p.patient_id} firstName={p.first_name} lastName={p.last_name} photoPath={p.photo_path} size={56} />
                    <span className={styles.avatarEditBadge}>
                      <Icon name="camera" size={12} />
                    </span>
                  </button>
                  <div className={styles.patientCardTitle}>
                    <div className={styles.patientName}>{fullName(p)}</div>
                    <div className={styles.patientMeta}>
                      {age !== null ? `${age} yrs` : 'Age unknown'} · {p.gender} · ID #{p.patient_id}
                    </div>
                  </div>
                  <span className={styles.bloodChip} title="Blood group">
                    {p.blood_type}
                  </span>
                </div>

                <div className={styles.patientFacts}>
                  <Field label="Date of birth">{formatDate(p.date_of_birth)}</Field>
                  <Field label="Allergies" alert={allergic}>
                    {allergic ? p.allergies : 'None recorded'}
                  </Field>
                  <Field label="Chronic conditions">{p.chronic_conditions || 'None recorded'}</Field>
                  <Field label="Last visit">
                    {lastVisitSummary(p) ?? <span className={styles.mutedText}>No previous visits</span>}
                  </Field>
                </div>

                <div className={styles.patientCardActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => onViewHistory(p.patient_id)}>
                    <Icon name="clock" /> History{p.records?.length ? ` (${p.records.length}${p.records.length >= 3 ? '+' : ''})` : ''}
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={() => onStartTriage(p.patient_id)}>
                    Start triage <Icon name="arrowRight" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {photoPatient && (
        <PatientPhotoModal
          patient={photoPatient}
          onClose={() => setPhotoPatient(null)}
          onSaved={(updated, message) => {
            setPhotoPatient(null);
            onPatientUpdated(updated, message);
          }}
        />
      )}
    </div>
  );
}
