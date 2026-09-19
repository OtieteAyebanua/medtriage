'use client';

import React, { useRef, useState } from 'react';
import styles from './Homescreen.module.css';
import { ageFrom, formatDate, fullName, hasAllergies, lastVisitSummary, matchesPatient } from './clinical';
import { Avatar, EmptyState, Field, Icon } from './shared';
import { PHOTO_ACCEPT, uploadPatientPhoto } from './api';
import { PatientItem } from './types';

interface Props {
  patients: PatientItem[];
  loading: boolean;
  onRegister: () => void;
  onStartTriage: (patientId: number) => void;
  onViewHistory: (patientId: number) => void;
  onPatientUpdated: (patient: PatientItem) => void;
  onError: (message: string) => void;
}

export default function PatientsTab({ patients, loading, onRegister, onStartTriage, onViewHistory, onPatientUpdated, onError }: Props) {
  const [query, setQuery] = useState('');
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<number | null>(null);

  const choosePhoto = (patientId: number) => {
    targetRef.current = patientId;
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    const patientId = targetRef.current;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !patientId) return;
    setUploadingId(patientId);
    try {
      const updated = await uploadPatientPhoto(patientId, file);
      const existing = patients.find((p) => p.patient_id === patientId);
      if (existing) onPatientUpdated({ ...existing, photo_path: updated.photo_path });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setUploadingId(null);
    }
  };
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

      <input
        ref={fileInputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className={styles.srOnly}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        aria-hidden="true"
        tabIndex={-1}
      />

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
                    onClick={() => choosePhoto(p.patient_id)}
                    title={p.photo_path ? 'Change photo' : 'Add photo'}
                    aria-label={p.photo_path ? `Change photo of ${fullName(p)}` : `Add photo of ${fullName(p)}`}
                    disabled={uploadingId === p.patient_id}
                  >
                    <Avatar patientId={p.patient_id} firstName={p.first_name} lastName={p.last_name} photoPath={p.photo_path} size={56} />
                    <span className={styles.avatarEditBadge}>
                      {uploadingId === p.patient_id ? <span className={styles.spinner} style={{ width: 12, height: 12 }} /> : <Icon name="camera" size={12} />}
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
    </div>
  );
}
