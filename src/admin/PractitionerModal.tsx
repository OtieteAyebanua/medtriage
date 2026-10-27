import React, { useState } from 'react';
import hs from '../Homescreen/Homescreen.module.css';
import styles from './Admin.module.css';
import { Modal, Notice, Spinner } from '../Homescreen/shared';
import { createPractitioner, errorMessage, Practitioner, PractitionerInput, PractitionerPosition, updatePractitioner } from '@/api';
import {
  generatePassword,
  MIN_PASSWORD_LENGTH,
  POSITIONS,
  practitionerName,
  requiresLicense,
  suggestEmployeeId,
  todayIso,
} from './practitioners';

interface Props {
  /** null to add a new practitioner */
  practitioner: Practitioner | null;
  /** Everyone already registered, for the employee ID suggestion and duplicate checks */
  existing: Practitioner[];
  onClose: () => void;
  onSaved: (practitioner: Practitioner, created: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PractitionerModal({ practitioner, existing, onClose, onSaved }: Props) {
  const isNew = practitioner === null;
  const others = existing.filter((p) => p.userId !== practitioner?.userId);

  const [firstName, setFirstName] = useState(practitioner?.firstName ?? '');
  const [middleName, setMiddleName] = useState(practitioner?.middleName ?? '');
  const [lastName, setLastName] = useState(practitioner?.lastName ?? '');
  const [gender, setGender] = useState(practitioner?.gender ?? 'Female');
  const [email, setEmail] = useState(practitioner?.email ?? '');
  const [phone, setPhone] = useState(practitioner?.phone ?? '');
  const [position, setPosition] = useState<PractitionerPosition>(practitioner?.position ?? 'doctor');
  const [department, setDepartment] = useState(practitioner?.department ?? '');
  const [employeeId, setEmployeeId] = useState(practitioner?.employeeId ?? suggestEmployeeId('doctor', existing));
  // Once the admin types their own ID, stop replacing it when the role changes
  const [employeeIdEdited, setEmployeeIdEdited] = useState(!isNew);
  const [licenseNumber, setLicenseNumber] = useState(practitioner?.licenseNumber ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(practitioner?.licenseExpiry ?? '');
  const [password, setPassword] = useState(isNew ? generatePassword() : '');
  const [showPassword, setShowPassword] = useState(isNew);
  const [verified, setVerified] = useState(!isNew);

  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const licenseRequired = requiresLicense(position);
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedId = employeeId.trim().toUpperCase();

  const errors: Partial<Record<string, string>> = {
    firstName: firstName.trim() ? undefined : 'First name is required',
    lastName: lastName.trim() ? undefined : 'Last name is required',
    email: !trimmedEmail
      ? 'Email is required'
      : !EMAIL_RE.test(trimmedEmail)
        ? 'Enter a valid email address'
        : others.some((p) => p.email.toLowerCase() === trimmedEmail)
          ? 'Another account already uses this email'
          : undefined,
    employeeId: !trimmedId
      ? 'Employee ID is required'
      : others.some((p) => p.employeeId.toUpperCase() === trimmedId)
        ? 'This employee ID is already taken'
        : undefined,
    licenseNumber: licenseRequired && !licenseNumber.trim() ? 'A licence number is required for clinical staff' : undefined,
    licenseExpiry: licenseRequired && !licenseExpiry
      ? 'Licence expiry is required for clinical staff'
      : licenseExpiry && licenseExpiry < todayIso()
        ? 'This licence has expired. Ask for proof of renewal before continuing'
        : undefined,
    password:
      (isNew || password) && password.length < MIN_PASSWORD_LENGTH
        ? `Use at least ${MIN_PASSWORD_LENGTH} characters`
        : undefined,
    verified: verified ? undefined : 'Confirm you have verified this practitioner',
  };
  const isValid = Object.values(errors).every((e) => !e);
  const show = (field: string) => (touched ? errors[field] : undefined);

  const changePosition = (next: PractitionerPosition) => {
    setPosition(next);
    if (!employeeIdEdited) setEmployeeId(suggestEmployeeId(next, existing));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!isValid) return;

    const input: PractitionerInput = {
      employeeId: trimmedId,
      firstName: firstName.trim(),
      middleName: middleName.trim() || undefined,
      lastName: lastName.trim(),
      email: trimmedEmail,
      phone: phone.trim() || undefined,
      gender,
      position,
      department: department.trim() || undefined,
      licenseNumber: licenseNumber.trim() || undefined,
      licenseExpiry: licenseExpiry || undefined,
      password: password || undefined,
    };

    setSubmitting(true);
    try {
      const saved = isNew ? await createPractitioner(input) : await updatePractitioner(practitioner.userId, input);
      onSaved(saved, isNew);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the practitioner.'));
      setSubmitting(false);
    }
  };

  const formId = 'practitioner-form';
  const inputClass = (field: string) => `${hs.textInput} ${show(field) ? hs.inputInvalid : ''}`;

  return (
    <Modal
      title={isNew ? 'Add verified practitioner' : `Edit ${practitionerName(practitioner)}`}
      subtitle="Fields marked * are required"
      onClose={onClose}
      locked={submitting}
      width="lg"
      footer={
        <>
          <button type="button" className={hs.btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form={formId} className={hs.btnPrimary} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner /> Saving…
              </>
            ) : isNew ? (
              'Add practitioner'
            ) : (
              'Save changes'
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        {error && <Notice kind="error">{error}</Notice>}
        {touched && !isValid && !error && <Notice kind="error">Fix the highlighted fields to continue.</Notice>}

        <h3 className={styles.formSection}>Personal details</h3>
        <div className={styles.formRow3}>
          <TextField id="pr-first" label="First name *" value={firstName} onChange={setFirstName} error={show('firstName')} className={inputClass('firstName')} />
          <TextField id="pr-middle" label="Middle name" value={middleName} onChange={setMiddleName} className={hs.textInput} />
          <TextField id="pr-last" label="Last name *" value={lastName} onChange={setLastName} error={show('lastName')} className={inputClass('lastName')} />
        </div>
        <div className={styles.formRow3}>
          <div className={hs.formGroup}>
            <label htmlFor="pr-gender" className={hs.inputLabel}>
              Sex *
            </label>
            <select id="pr-gender" className={hs.selectInput} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <TextField
            id="pr-email"
            label="Email *"
            type="email"
            value={email}
            onChange={setEmail}
            error={show('email')}
            className={inputClass('email')}
            placeholder="name@hospital.lan"
          />
          <TextField id="pr-phone" label="Phone" type="tel" value={phone} onChange={setPhone} className={hs.textInput} placeholder="Optional" />
        </div>

        <h3 className={styles.formSection}>Role</h3>
        <div className={styles.formRow3}>
          <div className={hs.formGroup}>
            <label htmlFor="pr-position" className={hs.inputLabel}>
              Position *
            </label>
            <select
              id="pr-position"
              className={hs.selectInput}
              value={position}
              onChange={(e) => changePosition(e.target.value as PractitionerPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            id="pr-department"
            label="Department / unit"
            value={department}
            onChange={setDepartment}
            className={hs.textInput}
            placeholder="e.g. Emergency, Paediatrics"
          />
          <TextField
            id="pr-employee-id"
            label="Employee ID *"
            value={employeeId}
            onChange={(v) => {
              setEmployeeId(v);
              setEmployeeIdEdited(true);
            }}
            error={show('employeeId')}
            hint={isNew && !show('employeeId') ? 'Used to sign in' : undefined}
            className={`${inputClass('employeeId')} ${styles.mono}`}
          />
        </div>

        <h3 className={styles.formSection}>Professional licence</h3>
        <div className={hs.formRow2}>
          <TextField
            id="pr-license"
            label={`Licence / registration number${licenseRequired ? ' *' : ''}`}
            value={licenseNumber}
            onChange={setLicenseNumber}
            error={show('licenseNumber')}
            className={`${inputClass('licenseNumber')} ${styles.mono}`}
            placeholder={licenseRequired ? 'e.g. MDCN/R/12345' : 'Not required for administrators'}
          />
          <TextField
            id="pr-license-expiry"
            label={`Licence valid until${licenseRequired ? ' *' : ''}`}
            type="date"
            value={licenseExpiry}
            onChange={setLicenseExpiry}
            error={show('licenseExpiry')}
            className={inputClass('licenseExpiry')}
          />
        </div>

        <h3 className={styles.formSection}>{isNew ? 'Sign-in' : 'Reset password'}</h3>
        <div className={hs.formGroup}>
          <label htmlFor="pr-password" className={hs.inputLabel}>
            {isNew ? 'Temporary password *' : 'New password'}
          </label>
          <div className={styles.passwordRow}>
            <input
              id="pr-password"
              type={showPassword ? 'text' : 'password'}
              className={`${inputClass('password')} ${styles.mono}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isNew ? undefined : 'Leave blank to keep the current password'}
              autoComplete="new-password"
              aria-invalid={!!show('password')}
            />
            <button type="button" className={hs.btnSecondary} onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              className={hs.btnSecondary}
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
            >
              Generate
            </button>
          </div>
          {show('password') ? (
            <span className={hs.fieldError}>{show('password')}</span>
          ) : (
            <span className={hs.inputHint}>Give this to the practitioner in person. They sign in with their employee ID or email.</span>
          )}
        </div>

        {isNew && (
          <label className={`${styles.attest} ${show('verified') ? styles.attestInvalid : ''}`}>
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            <span>
              <strong>I have verified this practitioner.</strong> I checked a government-issued ID and confirmed the licence above is
              current with the licensing body.
              {show('verified') && <span className={`${hs.fieldError} ${styles.attestError}`}>{show('verified')}</span>}
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  className,
  type = 'text',
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  className: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className={hs.formGroup}>
      <label htmlFor={id} className={hs.inputLabel}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={!!error}
      />
      {error ? <span className={hs.fieldError}>{error}</span> : hint && <span className={hs.inputHint}>{hint}</span>}
    </div>
  );
}
