'use client';

import React, { useState } from 'react';
import styles from './Homescreen.module.css';
// Removed apiFetch and uploadPatientPhoto import
import PhotoPicker from './PhotoPicker';
import { Modal, Notice, Spinner } from './shared';
import { PatientItem } from './types';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

interface Props {
  onClose: () => void;
  onRegistered: (patient: PatientItem) => void;
}

export default function RegisterPatientModal({ onClose, onRegistered }: Props) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Female');
  const [email, setEmail] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const missing = {
    firstName: !firstName.trim(),
    lastName: !lastName.trim(),
    dob: !dob || dob > today,
    email: email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
  };
  const isValid = !missing.firstName && !missing.lastName && !missing.dob && !missing.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!isValid) return;

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      let patient: PatientItem = {
        patient_id: Date.now(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        gender: gender,
        blood_type: bloodType,
        photo_path: null
      };
      onRegistered(patient);
    } catch (err) {
      console.error(err);
      setError('An error occurred during registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const formId = 'register-patient-form';

  return (
    <Modal
      title="Register new patient"
      subtitle="Fields marked * are required"
      onClose={onClose}
      locked={submitting}
      footer={
        <>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form={formId} className={styles.btnPrimary} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              'Save patient'
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        {error && <Notice kind="error">{error}</Notice>}

        <div className={styles.formGroup}>
          <span className={styles.inputLabel}>Photo</span>
          <PhotoPicker patientId={0} firstName={firstName} lastName={lastName} onChange={setPhoto} disabled={submitting} />
        </div>

        <div className={styles.formRow2}>
          <div className={styles.formGroup}>
            <label htmlFor="reg-first" className={styles.inputLabel}>
              First name *
            </label>
            <input
              id="reg-first"
              type="text"
              className={`${styles.textInput} ${touched && missing.firstName ? styles.inputInvalid : ''}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
              aria-invalid={touched && missing.firstName}
            />
            {touched && missing.firstName && <span className={styles.fieldError}>First name is required</span>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="reg-middle" className={styles.inputLabel}>
              Middle name
            </label>
            <input
              id="reg-middle"
              type="text"
              className={styles.textInput}
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="reg-last" className={styles.inputLabel}>
            Last name *
          </label>
          <input
            id="reg-last"
            type="text"
            className={`${styles.textInput} ${touched && missing.lastName ? styles.inputInvalid : ''}`}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="off"
            aria-invalid={touched && missing.lastName}
          />
          {touched && missing.lastName && <span className={styles.fieldError}>Last name is required</span>}
        </div>

        <div className={styles.formRow2}>
          <div className={styles.formGroup}>
            <label htmlFor="reg-dob" className={styles.inputLabel}>
              Date of birth *
            </label>
            <input
              id="reg-dob"
              type="date"
              max={today}
              className={`${styles.textInput} ${touched && missing.dob ? styles.inputInvalid : ''}`}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              aria-invalid={touched && missing.dob}
            />
            {touched && missing.dob && (
              <span className={styles.fieldError}>{dob ? 'Date cannot be in the future' : 'Date of birth is required'}</span>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="reg-gender" className={styles.inputLabel}>
              Sex *
            </label>
            <select id="reg-gender" className={styles.selectInput} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <span className={styles.inputLabel}>Blood group *</span>
          <div className={styles.segmented} role="radiogroup" aria-label="Blood group">
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                type="button"
                role="radio"
                aria-checked={bloodType === bt}
                className={`${styles.segment} ${bloodType === bt ? styles.segmentActive : ''}`}
                onClick={() => setBloodType(bt)}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="reg-email" className={styles.inputLabel}>
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            className={`${styles.textInput} ${touched && missing.email ? styles.inputInvalid : ''}`}
            placeholder="Optional"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            aria-invalid={touched && missing.email}
          />
          {touched && missing.email && <span className={styles.fieldError}>Enter a valid email address or leave blank</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="reg-allergies" className={styles.inputLabel}>
            Known allergies
          </label>
          <input
            id="reg-allergies"
            type="text"
            className={styles.textInput}
            placeholder="e.g. Penicillin, NSAIDs — leave blank if none"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="reg-chronic" className={styles.inputLabel}>
            Chronic conditions
          </label>
          <input
            id="reg-chronic"
            type="text"
            className={styles.textInput}
            placeholder="e.g. Hypertension, Type 2 diabetes"
            value={chronic}
            onChange={(e) => setChronic(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
