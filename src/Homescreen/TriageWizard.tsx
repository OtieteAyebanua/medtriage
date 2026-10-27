'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './Homescreen.module.css';
import { errorMessage, RunTriageResult, runTriage as runTriageRequest } from '@/api';
import {
  ageFrom,
  AVPU_OPTIONS,
  DURATION_OPTIONS,
  flagsForSymptom,
  formatDate,
  fullName,
  getVitalStatus,
  hasAllergies,
  isFemale,
  lastVisitSummary,
  matchesPatient,
  MOBILITY_OPTIONS,
  optionLabel,
  percent,
  relativeTime,
  SEVERITY_OPTIONS,
  SYMPTOM_FLAGS,
  TRIAGE_LEVELS,
  clampLevel,
  VISIT_TYPES,
  visitTypeLabel,
  VITAL_DEFS,
} from './clinical';
import { Avatar, EmptyState, Field, Icon, LevelBadge, levelClass, Notice, SectionLabel, Spinner, VitalStatusPill } from './shared';
import { PatientItem, Screening, SelectedSymptom, SymptomItem, TriageResult, Vitals } from './types';

const STEPS = [
  { num: 1, label: 'Patient' },
  { num: 2, label: 'Vitals' },
  { num: 3, label: 'Symptoms' },
  { num: 4, label: 'Review' },
  { num: 5, label: 'Result' },
];

const EMPTY_VITALS: Vitals = { temp: '', bp: '', heartRate: '', spo2: '', respRate: '' };
const EMPTY_SCREENING: Screening = { pregnant: null, rainySeason: null, daysFebrile: '', avpu: null, mobility: null };
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const yesNoValue = (v: boolean | null) => (v === null ? null : v ? 'yes' : 'no');
const yesNoLabel = (v: boolean | null) => (v === null ? 'Not asked' : v ? 'Yes' : 'No');

/** Which engine produced a result, shown under it */
type EngineInfo = Pick<RunTriageResult, 'engine' | 'model' | 'safety_raised_from'>;

export interface PatientRequest {
  patientId: number;
  /** Start a fresh assessment for this patient (from the registry) */
  reset: boolean;
  nonce: number;
}

interface Props {
  patients: PatientItem[];
  symptoms: SymptomItem[];
  canReview: boolean;
  patientRequest: PatientRequest | null;
  onRegister: () => void;
  onViewHistory: (patientId: number) => void;
  onTriageSaved: () => void;
  onGoToQueue: () => void;
}

export default function TriageWizard({
  patients,
  symptoms,
  canReview,
  patientRequest,
  onRegister,
  onViewHistory,
  onTriageSaved,
  onGoToQueue,
}: Props) {
  const [step, setStep] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [visitType, setVisitType] = useState('walk_in');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [symptomQuery, setSymptomQuery] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([]);
  const [screening, setScreening] = useState<Screening>(EMPTY_SCREENING);
  /** Ticked checklist keys */
  const [symptomFlags, setSymptomFlags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);

  const resetAll = () => {
    setStep(1);
    setSelectedPatientId(null);
    setPatientQuery('');
    setVisitType('walk_in');
    setChiefComplaint('');
    setVitals(EMPTY_VITALS);
    setSymptomQuery('');
    setSelectedSymptoms([]);
    setScreening(EMPTY_SCREENING);
    setSymptomFlags([]);
    setSubmitError(null);
    setResult(null);
    setRecordId(null);
    setEngineInfo(null);
  };

  // Requests from other tabs: "Start triage" in the registry or a newly registered patient.
  useEffect(() => {
    if (!patientRequest) return;
    if (patientRequest.reset) resetAll();
    setSelectedPatientId(patientRequest.patientId);
    setPatientQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientRequest?.nonce]);

  const currentPatient = patients.find((p) => p.patient_id === selectedPatientId) ?? null;
  const complaintOk = chiefComplaint.trim().length > 0;
  const step1Ok = !!currentPatient && complaintOk;
  const bpStatus = getVitalStatus('bp', vitals.bp);
  const daysFebrileOk = !screening.daysFebrile.trim() || /^\d{1,3}$/.test(screening.daysFebrile.trim());
  const vitalsOk = bpStatus.kind !== 'invalid' && daysFebrileOk;
  const female = isFemale(currentPatient?.gender);
  const recordedVitalsCount = VITAL_DEFS.filter((d) => vitals[d.key].trim()).length;

  const filteredPatients = useMemo(
    () => patients.filter((p) => matchesPatient(p, patientQuery)),
    [patients, patientQuery],
  );

  const filteredSymptoms = useMemo(() => {
    const q = symptomQuery.trim().toLowerCase();
    if (!q) return symptoms;
    return symptoms.filter(
      (s) =>
        s.symptom_name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.synonyms ?? '').toLowerCase().includes(q),
    );
  }, [symptoms, symptomQuery]);

  const symptomsByCategory = useMemo(() => {
    const groups: Record<string, SymptomItem[]> = {};
    for (const s of filteredSymptoms) {
      const cat = s.category || 'other';
      (groups[cat] ??= []).push(s);
    }
    return Object.entries(groups);
  }, [filteredSymptoms]);

  const toggleFlag = (key: string) => {
    setSymptomFlags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleSymptom = (sym: SymptomItem) => {
    // Picking a catalogue symptom ticks the matching checklist items; removing it leaves them for the nurse to untick
    if (!selectedSymptoms.some((s) => s.symptomId === sym.symptom_id)) {
      const implied = flagsForSymptom(sym.symptom_name);
      setSymptomFlags((prev) => [...prev, ...implied.filter((k) => !prev.includes(k))]);
    }
    setSelectedSymptoms((prev) =>
      prev.some((s) => s.symptomId === sym.symptom_id)
        ? prev.filter((s) => s.symptomId !== sym.symptom_id)
        : [...prev, { symptomId: sym.symptom_id, name: sym.symptom_name, severity: 'Moderate', duration: '1–2 days', notes: '' }],
    );
  };

  const updateSymptom = (symptomId: number, patch: Partial<SelectedSymptom>) => {
    setSelectedSymptoms((prev) => prev.map((s) => (s.symptomId === symptomId ? { ...s, ...patch } : s)));
  };

  const runTriage = async () => {
    if (!currentPatient) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Blank vitals were not measured and are sent as null
      const num = (raw: string) => (raw.trim() ? Number(raw.trim()) : null);
      const data = await runTriageRequest({
        patientId: currentPatient.patient_id,
        visitType,
        chiefComplaint: chiefComplaint.trim(),
        vitals: {
          temperature: num(vitals.temp),
          bloodPressure: vitals.bp.trim() || null,
          heartRate: num(vitals.heartRate),
          oxygenLevel: num(vitals.spo2),
          respiratoryRate: num(vitals.respRate),
        },
        symptoms: selectedSymptoms.map((s) => ({
          symptomId: s.symptomId,
          severity: s.severity,
          duration: s.duration,
          notes: s.notes.trim() || null,
        })),
        screening: {
          pregnant: female ? screening.pregnant : false,
          rainySeason: screening.rainySeason,
          daysFebrile: num(screening.daysFebrile),
          avpu: screening.avpu,
          mobility: screening.mobility,
          symptomFlags: Object.fromEntries(SYMPTOM_FLAGS.map((f) => [f.key, symptomFlags.includes(f.key)])),
        },
      });
      setResult(data.triage);
      setRecordId(data.record_id);
      setEngineInfo({ engine: data.engine, model: data.model, safety_raised_from: data.safety_raised_from });
      setStep(5);
      onTriageSaved();
    } catch (err) {
      setSubmitError(errorMessage(err, 'Could not run the triage assessment.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goTo = (n: number) => {
    // Once a result is saved the inputs are frozen; only step 5 is reachable.
    if (result) return;
    if (n < step) setStep(n);
  };

  const stepDone = (n: number) => (result ? n < 5 : n < step);

  /* ---------------- Render ---------------- */

  return (
    <div>
      <ol className={styles.stepper} aria-label="Triage steps">
        {STEPS.map((s, i) => {
          const isActive = step === s.num;
          const isDone = stepDone(s.num);
          const clickable = !result && s.num < step;
          return (
            <li key={s.num} className={styles.stepItem}>
              <button
                type="button"
                className={`${styles.stepButton} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}
                onClick={() => goTo(s.num)}
                disabled={!clickable}
                aria-current={isActive ? 'step' : undefined}
                title={clickable ? `Back to ${s.label}` : undefined}
              >
                <span className={styles.stepCircle}>{isDone ? <Icon name="check" size={14} /> : s.num}</span>
                <span className={styles.stepLabel}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={`${styles.stepLine} ${isDone ? styles.stepLineDone : ''}`} />}
            </li>
          );
        })}
      </ol>

      <div className={styles.wizardLayout}>
        <div className={styles.wizardMain}>
          {/* ---------- STEP 1: Patient & complaint ---------- */}
          {step === 1 && (
            <section className={styles.card} aria-labelledby="step1-title">
              <header className={styles.cardHead}>
                <h2 id="step1-title" className={styles.cardTitle}>
                  Who is the patient?
                </h2>
                <p className={styles.cardDesc}>Pick a registered patient and describe why they came in today.</p>
              </header>

              <div className={styles.formGroup}>
                <label htmlFor="patient-search" className={styles.inputLabel}>
                  Patient *
                </label>
                {currentPatient ? (
                  <div className={styles.patientSelected}>
                    <Avatar
                      patientId={currentPatient.patient_id}
                      firstName={currentPatient.first_name}
                      lastName={currentPatient.last_name}
                      photoPath={currentPatient.photo_path}
                      size={64}
                    />
                    <div className={styles.patientSelectedInfo}>
                      <div className={styles.patientName}>{fullName(currentPatient)}</div>
                      <div className={styles.patientMeta}>
                        {ageFrom(currentPatient.date_of_birth) ?? '?'} yrs · {currentPatient.gender} · Blood group{' '}
                        {currentPatient.blood_type} · ID #{currentPatient.patient_id}
                      </div>
                      <div className={styles.lastVisitLine}>
                        <Icon name="clock" size={13} />
                        {lastVisitSummary(currentPatient) ?? 'First visit — no previous assessments'}
                        {currentPatient.records?.length ? (
                          <button type="button" className={styles.btnLink} onClick={() => onViewHistory(currentPatient.patient_id)}>
                            View history
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setSelectedPatientId(null)}
                      id="patient-search"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.searchField}>
                      <Icon name="search" size={16} className={styles.searchIcon} />
                      <input
                        id="patient-search"
                        type="search"
                        className={styles.searchInput}
                        placeholder="Search by name, ID or blood group…"
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    <div className={styles.patientPickList} role="listbox" aria-label="Matching patients">
                      {filteredPatients.length === 0 ? (
                        <div className={styles.pickListEmpty}>
                          {patients.length === 0 ? 'No patients registered yet.' : `No patients match “${patientQuery}”.`}
                        </div>
                      ) : (
                        filteredPatients.slice(0, 8).map((p) => (
                          <button
                            key={p.patient_id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            className={styles.pickRow}
                            onClick={() => setSelectedPatientId(p.patient_id)}
                          >
                            <Avatar patientId={p.patient_id} firstName={p.first_name} lastName={p.last_name} photoPath={p.photo_path} size={40} />
                            <span className={styles.pickRowMain}>
                              <span className={styles.pickRowName}>{fullName(p)}</span>
                              <span className={styles.pickRowMeta}>
                                {ageFrom(p.date_of_birth) ?? '?'} yrs · {p.gender} · {p.blood_type} · #{p.patient_id}
                                {p.records?.[0] ? ` · last seen ${relativeTime(p.records[0].visit_date)}` : ' · first visit'}
                              </span>
                            </span>
                            {hasAllergies(p) && (
                              <span className={styles.allergyFlag} title={p.allergies ?? ''}>
                                <Icon name="alert" size={12} /> Allergy
                              </span>
                            )}
                            <Icon name="arrowRight" size={16} className={styles.pickRowArrow} />
                          </button>
                        ))
                      )}
                      {filteredPatients.length > 8 && (
                        <div className={styles.pickListEmpty}>
                          {filteredPatients.length - 8} more — keep typing to narrow the list.
                        </div>
                      )}
                    </div>
                    <button type="button" className={styles.btnLink} onClick={onRegister}>
                      <Icon name="plus" size={14} /> Not registered yet? Register new patient
                    </button>
                  </>
                )}
              </div>

              {currentPatient && (
                <div className={styles.profilePill}>
                  <Field label="Date of birth">{formatDate(currentPatient.date_of_birth)}</Field>
                  <Field label="Blood group">{currentPatient.blood_type}</Field>
                  <Field label="Allergies" alert={hasAllergies(currentPatient)}>
                    {hasAllergies(currentPatient) ? currentPatient.allergies : 'None recorded'}
                  </Field>
                  <Field label="Chronic conditions">{currentPatient.chronic_conditions || 'None recorded'}</Field>
                </div>
              )}

              <div className={styles.formGroup}>
                <span className={styles.inputLabel}>Visit type</span>
                <div className={styles.segmented} role="radiogroup" aria-label="Visit type">
                  {VISIT_TYPES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      role="radio"
                      aria-checked={visitType === v.value}
                      className={`${styles.segment} ${visitType === v.value ? styles.segmentActive : ''}`}
                      onClick={() => setVisitType(v.value)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="chief-complaint" className={styles.inputLabel}>
                  Chief complaint *
                </label>
                <textarea
                  id="chief-complaint"
                  className={styles.textArea}
                  rows={2}
                  placeholder="In the patient's words — e.g. “High fever and headache for 3 days”"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
                <span className={styles.inputHint}>
                  Key words like “chest pain” or “unconscious” are picked up by the triage engine.
                </span>
              </div>

              <footer className={styles.wizardNav}>
                <span className={styles.navHint}>
                  {!currentPatient ? 'Select a patient to continue' : !complaintOk ? 'Enter the chief complaint to continue' : ''}
                </span>
                <button type="button" className={styles.btnPrimary} disabled={!step1Ok} onClick={() => setStep(2)}>
                  Next: Vitals <Icon name="arrowRight" />
                </button>
              </footer>
            </section>
          )}

          {/* ---------- STEP 2: Vitals ---------- */}
          {step === 2 && (
            <section className={styles.card} aria-labelledby="step2-title">
              <header className={styles.cardHead}>
                <h2 id="step2-title" className={styles.cardTitle}>
                  Vital signs
                </h2>
                <p className={styles.cardDesc}>
                  Enter what was measured. Leave anything that wasn&apos;t measured blank — the engine only uses recorded values.
                </p>
              </header>

              <div className={styles.vitalsGrid}>
                {VITAL_DEFS.map((def) => {
                  const status = getVitalStatus(def.key, vitals[def.key]);
                  return (
                    <div
                      key={def.key}
                      className={`${styles.vitalBox} ${status.kind === 'danger' || status.kind === 'invalid' ? styles.vitalBoxDanger : status.kind === 'warning' ? styles.vitalBoxWarning : ''}`}
                    >
                      <div className={styles.vitalHeader}>
                        <label htmlFor={`vital-${def.key}`}>{def.label}</label>
                        <VitalStatusPill status={status} />
                      </div>
                      <div className={styles.vitalInputWrap}>
                        <input
                          id={`vital-${def.key}`}
                          type="text"
                          inputMode={def.inputMode}
                          className={styles.vitalInput}
                          value={vitals[def.key]}
                          onChange={(e) => setVitals({ ...vitals, [def.key]: e.target.value })}
                          placeholder={def.placeholder}
                          aria-invalid={status.kind === 'invalid'}
                          aria-describedby={`vital-${def.key}-hint`}
                        />
                        <span className={styles.vitalUnit}>{def.unit}</span>
                      </div>
                      <span id={`vital-${def.key}-hint`} className={styles.vitalHint}>
                        Normal: {def.normal}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.selectedSymptoms}>
                <SectionLabel>Observations</SectionLabel>
                <p className={styles.mutedText}>Used by the diagnosis model. Leave anything you didn&apos;t ask unselected.</p>

                <div className={styles.formGroup}>
                  <span className={styles.inputLabel}>Level of consciousness (AVPU)</span>
                  <ChoiceSegment
                    label="Level of consciousness"
                    options={AVPU_OPTIONS}
                    value={screening.avpu}
                    onChange={(avpu) => setScreening({ ...screening, avpu })}
                  />
                </div>

                <div className={styles.formRow2}>
                  <div className={styles.formGroup}>
                    <span className={styles.inputLabel}>Mobility</span>
                    <ChoiceSegment
                      label="Mobility"
                      options={MOBILITY_OPTIONS}
                      value={screening.mobility}
                      onChange={(mobility) => setScreening({ ...screening, mobility })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="days-febrile" className={styles.inputLabel}>
                      Days with fever
                    </label>
                    <input
                      id="days-febrile"
                      type="text"
                      inputMode="numeric"
                      className={`${styles.textInput} ${daysFebrileOk ? '' : styles.inputInvalid}`}
                      placeholder="e.g. 3 — 0 if no fever"
                      value={screening.daysFebrile}
                      onChange={(e) => setScreening({ ...screening, daysFebrile: e.target.value })}
                      aria-invalid={!daysFebrileOk}
                    />
                  </div>
                </div>

                <div className={styles.formRow2}>
                  {female && (
                    <div className={styles.formGroup}>
                      <span className={styles.inputLabel}>Pregnant?</span>
                      <ChoiceSegment
                        label="Pregnant"
                        options={YES_NO}
                        value={yesNoValue(screening.pregnant)}
                        onChange={(v) => setScreening({ ...screening, pregnant: v === null ? null : v === 'yes' })}
                      />
                    </div>
                  )}
                  <div className={styles.formGroup}>
                    <span className={styles.inputLabel}>Rainy season?</span>
                    <ChoiceSegment
                      label="Rainy season"
                      options={YES_NO}
                      value={yesNoValue(screening.rainySeason)}
                      onChange={(v) => setScreening({ ...screening, rainySeason: v === null ? null : v === 'yes' })}
                    />
                  </div>
                </div>
              </div>

              <footer className={styles.wizardNav}>
                <button type="button" className={styles.btnSecondary} onClick={() => setStep(1)}>
                  <Icon name="arrowLeft" /> Back
                </button>
                <span className={styles.navHint}>
                  {!daysFebrileOk
                    ? 'Days with fever must be a whole number'
                    : !vitalsOk
                    ? 'Fix the blood pressure format to continue'
                    : recordedVitalsCount === 0
                      ? 'No vitals recorded — you can still continue'
                      : `${recordedVitalsCount} of ${VITAL_DEFS.length} recorded`}
                </span>
                <button type="button" className={styles.btnPrimary} disabled={!vitalsOk} onClick={() => setStep(3)}>
                  Next: Symptoms <Icon name="arrowRight" />
                </button>
              </footer>
            </section>
          )}

          {/* ---------- STEP 3: Symptoms ---------- */}
          {step === 3 && (
            <section className={styles.card} aria-labelledby="step3-title">
              <header className={styles.cardHead}>
                <h2 id="step3-title" className={styles.cardTitle}>
                  Presenting symptoms
                </h2>
                <p className={styles.cardDesc}>Tap each symptom the patient has. You can set severity and duration below.</p>
              </header>

              <div className={styles.searchField}>
                <Icon name="search" size={16} className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search symptoms…"
                  value={symptomQuery}
                  onChange={(e) => setSymptomQuery(e.target.value)}
                  aria-label="Search symptoms"
                />
              </div>

              {symptomsByCategory.length === 0 ? (
                <div className={styles.pickListEmpty}>
                  {symptoms.length === 0 ? 'Symptom catalogue is still loading…' : `No symptoms match “${symptomQuery}”.`}
                </div>
              ) : (
                symptomsByCategory.map(([category, syms]) => (
                  <div key={category} className={styles.symptomGroup}>
                    <div className={styles.symptomCategory}>{category}</div>
                    <div className={styles.symptomPills}>
                      {syms.map((sym) => {
                        const on = selectedSymptoms.some((s) => s.symptomId === sym.symptom_id);
                        return (
                          <button
                            key={sym.symptom_id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleSymptom(sym)}
                            className={`${styles.symptomPill} ${on ? styles.symptomPillActive : ''}`}
                            title={sym.description}
                          >
                            <Icon name={on ? 'check' : 'plus'} size={13} />
                            {sym.symptom_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              <div className={styles.selectedSymptoms}>
                <SectionLabel>Selected symptoms ({selectedSymptoms.length})</SectionLabel>
                {selectedSymptoms.length === 0 ? (
                  <p className={styles.mutedText}>Nothing selected yet. You can continue without symptoms if none apply.</p>
                ) : (
                  <div className={styles.selectedList}>
                    {selectedSymptoms.map((s) => {
                      const catalogue = symptoms.find((x) => x.symptom_id === s.symptomId);
                      const questions = (catalogue?.follow_up_questions ?? '')
                        .split(/\?\s*/)
                        .map((q) => q.trim())
                        .filter(Boolean)
                        .map((q) => `${q}?`);
                      return (
                      <div key={s.symptomId} className={styles.selectedBlock}>
                      <div className={styles.selectedRow}>
                        <span className={styles.selectedName}>{s.name}</span>
                        <div className={styles.segmented} role="radiogroup" aria-label={`${s.name} severity`}>
                          {SEVERITY_OPTIONS.map((sev) => (
                            <button
                              key={sev}
                              type="button"
                              role="radio"
                              aria-checked={s.severity === sev}
                              className={`${styles.segment} ${styles.segmentSm} ${s.severity === sev ? styles.segmentActive : ''}`}
                              onClick={() => updateSymptom(s.symptomId, { severity: sev })}
                            >
                              {sev}
                            </button>
                          ))}
                        </div>
                        <select
                          className={styles.selectInputSm}
                          value={s.duration}
                          onChange={(e) => updateSymptom(s.symptomId, { duration: e.target.value })}
                          aria-label={`${s.name} duration`}
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => setSelectedSymptoms((prev) => prev.filter((x) => x.symptomId !== s.symptomId))}
                          aria-label={`Remove ${s.name}`}
                          title="Remove"
                        >
                          <Icon name="x" size={16} />
                        </button>
                      </div>
                      {questions.length > 0 && (
                        <div className={styles.followUp}>
                          <span className={styles.followUpLabel}>Ask the patient:</span>
                          <ul className={styles.followUpList}>
                            {questions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <input
                        type="text"
                        className={styles.notesInput}
                        placeholder="Notes — e.g. worse at night, started after meals (optional)"
                        value={s.notes}
                        onChange={(e) => updateSymptom(s.symptomId, { notes: e.target.value })}
                        aria-label={`${s.name} notes`}
                        maxLength={500}
                      />
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.selectedSymptoms}>
                <SectionLabel right={<span className={styles.tableMuted}>{symptomFlags.length} ticked</span>}>
                  Symptom checklist
                </SectionLabel>
                <p className={styles.mutedText}>
                  Ask about each one and tick all that apply. Symptoms picked above are ticked for you; anything left unticked is saved
                  as “no”.
                </p>
                <div className={styles.symptomPills}>
                  {SYMPTOM_FLAGS.map((f) => {
                    const on = symptomFlags.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFlag(f.key)}
                        className={`${styles.symptomPill} ${on ? styles.symptomPillActive : ''}`}
                      >
                        <Icon name={on ? 'check' : 'plus'} size={13} />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <footer className={styles.wizardNav}>
                <button type="button" className={styles.btnSecondary} onClick={() => setStep(2)}>
                  <Icon name="arrowLeft" /> Back
                </button>
                <span className={styles.navHint} />
                <button type="button" className={styles.btnPrimary} onClick={() => setStep(4)}>
                  Next: Review <Icon name="arrowRight" />
                </button>
              </footer>
            </section>
          )}

          {/* ---------- STEP 4: Review & run ---------- */}
          {step === 4 && (
            <section className={styles.card} aria-labelledby="step4-title">
              <header className={styles.cardHead}>
                <h2 id="step4-title" className={styles.cardTitle}>
                  Check and run triage
                </h2>
                <p className={styles.cardDesc}>
                  Confirm everything below. Running triage saves the record and sends it to the doctor review queue.
                </p>
              </header>

              {submitError && <Notice kind="error">{submitError}</Notice>}

              <div className={styles.reviewGrid}>
                <div className={styles.reviewCard}>
                  <SectionLabel
                    right={
                      <button type="button" className={styles.btnLink} onClick={() => setStep(1)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    }
                  >
                    Patient &amp; visit
                  </SectionLabel>
                  <Field label="Patient">{currentPatient ? fullName(currentPatient) : '—'}</Field>
                  <Field label="Age / sex">
                    {currentPatient ? `${ageFrom(currentPatient.date_of_birth) ?? '?'} yrs · ${currentPatient.gender}` : '—'}
                  </Field>
                  <Field label="Blood group">{currentPatient?.blood_type || '—'}</Field>
                  <Field label="Allergies" alert={!!currentPatient && hasAllergies(currentPatient)}>
                    {currentPatient && hasAllergies(currentPatient) ? currentPatient.allergies : 'None recorded'}
                  </Field>
                  <Field label="Visit type">{visitTypeLabel(visitType)}</Field>
                  <Field label="Chief complaint">{chiefComplaint}</Field>
                </div>

                <div className={styles.reviewCard}>
                  <SectionLabel
                    right={
                      <button type="button" className={styles.btnLink} onClick={() => setStep(2)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    }
                  >
                    Vitals
                  </SectionLabel>
                  {VITAL_DEFS.map((def) => {
                    const status = getVitalStatus(def.key, vitals[def.key]);
                    return (
                      <div key={def.key} className={styles.reviewVitalRow}>
                        <span className={styles.fieldLabel}>{def.label}</span>
                        <span className={styles.reviewVitalValue}>
                          {vitals[def.key].trim() ? (
                            <strong>
                              {vitals[def.key]} {def.unit}
                            </strong>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                          <VitalStatusPill status={status} />
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className={`${styles.reviewCard} ${styles.reviewCardWide}`}>
                  <SectionLabel
                    right={
                      <button type="button" className={styles.btnLink} onClick={() => setStep(3)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    }
                  >
                    Symptoms ({selectedSymptoms.length})
                  </SectionLabel>
                  {selectedSymptoms.length === 0 ? (
                    <p className={styles.mutedText}>No symptoms selected.</p>
                  ) : (
                    <div className={styles.chipRow}>
                      {selectedSymptoms.map((s) => (
                        <span key={s.symptomId} className={styles.chip} title={s.notes || undefined}>
                          <strong>{s.name}</strong> · {s.severity} · {s.duration}
                          {s.notes.trim() ? ` · “${s.notes.trim()}”` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`${styles.reviewCard} ${styles.reviewCardWide}`}>
                  <SectionLabel
                    right={
                      <button type="button" className={styles.btnLink} onClick={() => setStep(2)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    }
                  >
                    Observations
                  </SectionLabel>
                  <Field label="Consciousness (AVPU)">{optionLabel(AVPU_OPTIONS, screening.avpu)}</Field>
                  <Field label="Mobility">{optionLabel(MOBILITY_OPTIONS, screening.mobility)}</Field>
                  <Field label="Days with fever">{screening.daysFebrile.trim() || '—'}</Field>
                  {female && <Field label="Pregnant">{yesNoLabel(screening.pregnant)}</Field>}
                  <Field label="Rainy season">{yesNoLabel(screening.rainySeason)}</Field>
                </div>

                <div className={`${styles.reviewCard} ${styles.reviewCardWide}`}>
                  <SectionLabel
                    right={
                      <button type="button" className={styles.btnLink} onClick={() => setStep(3)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    }
                  >
                    Symptom checklist ({symptomFlags.length} of {SYMPTOM_FLAGS.length})
                  </SectionLabel>
                  {symptomFlags.length === 0 ? (
                    <p className={styles.mutedText}>Nothing ticked — all saved as “no”.</p>
                  ) : (
                    <div className={styles.chipRow}>
                      {SYMPTOM_FLAGS.filter((f) => symptomFlags.includes(f.key)).map((f) => (
                        <span key={f.key} className={styles.chip}>
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className={styles.wizardNav}>
                <button type="button" className={styles.btnSecondary} onClick={() => setStep(3)} disabled={isSubmitting}>
                  <Icon name="arrowLeft" /> Back
                </button>
                <span className={styles.navHint} />
                <button type="button" className={`${styles.btnPrimary} ${styles.btnLarge}`} disabled={isSubmitting} onClick={runTriage}>
                  {isSubmitting ? (
                    <>
                      <Spinner /> Running triage…
                    </>
                  ) : (
                    <>
                      <Icon name="zap" /> Run triage &amp; save
                    </>
                  )}
                </button>
              </footer>
            </section>
          )}

          {/* ---------- STEP 5: Result ---------- */}
          {step === 5 && (
            <section className={styles.card} aria-labelledby="step5-title">
              <header className={styles.cardHead}>
                <h2 id="step5-title" className={styles.cardTitle}>
                  Triage result
                </h2>
                <p className={styles.cardDesc}>
                  AI-suggested urgency for {currentPatient ? fullName(currentPatient) : 'the patient'}. A doctor confirms or overrides
                  it in the review queue.
                </p>
              </header>

              {!result ? (
                <EmptyState icon="zap" title="No result to show">
                  Start a new assessment to run the triage engine.
                </EmptyState>
              ) : (
                <ResultView result={result} recordId={recordId} engine={engineInfo} canReview={canReview} onGoToQueue={onGoToQueue} onNew={resetAll} />
              )}
            </section>
          )}
        </div>

        {/* ---------- Summary sidebar ---------- */}
        <aside className={styles.summaryPanel} aria-label="Assessment summary">
          <div className={styles.summaryTitle}>This assessment</div>

          <SummaryRow label="Patient" done={!!currentPatient} onEdit={!result && step > 1 ? () => setStep(1) : undefined}>
            {currentPatient ? fullName(currentPatient) : <span className={styles.mutedText}>Not selected</span>}
          </SummaryRow>
          <SummaryRow label="Visit" done={complaintOk}>
            {visitTypeLabel(visitType)}
            {chiefComplaint.trim() && <span className={styles.summarySub}>{chiefComplaint.trim()}</span>}
          </SummaryRow>
          <SummaryRow label="Vitals" done={step > 2} onEdit={!result && step > 2 ? () => setStep(2) : undefined}>
            {recordedVitalsCount === 0 ? (
              <span className={styles.mutedText}>{step > 2 ? 'None recorded' : 'Pending'}</span>
            ) : (
              <span className={styles.summaryVitals}>
                {VITAL_DEFS.filter((d) => vitals[d.key].trim()).map((d) => {
                  const st = getVitalStatus(d.key, vitals[d.key]);
                  return (
                    <span
                      key={d.key}
                      className={`${styles.summaryVital} ${st.kind === 'danger' || st.kind === 'invalid' ? styles.textDanger : st.kind === 'warning' ? styles.textWarn : ''}`}
                      title={`${d.label}: ${st.label}`}
                    >
                      {vitals[d.key]}
                      {d.unit === '%' ? '%' : ` ${d.unit}`}
                    </span>
                  );
                })}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Symptoms" done={step > 3} onEdit={!result && step > 3 ? () => setStep(3) : undefined}>
            {selectedSymptoms.length === 0 ? (
              <span className={styles.mutedText}>{step > 3 ? 'None' : 'Pending'}</span>
            ) : (
              <span className={styles.chipRow}>
                {selectedSymptoms.map((s) => (
                  <span key={s.symptomId} className={styles.chipSm}>
                    {s.name}
                  </span>
                ))}
              </span>
            )}
          </SummaryRow>
          {result && (
            <SummaryRow label="Result" done>
              <LevelBadge level={result.urgency_level} />
            </SummaryRow>
          )}

          {!result && step > 1 && (
            <button type="button" className={styles.btnLink} onClick={resetAll} style={{ marginTop: '0.75rem' }}>
              <Icon name="x" size={13} /> Discard and start over
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

/** Single-choice segmented control; clicking the selected option clears it back to "not asked". */
function ChoiceSegment({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${styles.segment} ${value === o.value ? styles.segmentActive : ''}`}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  done,
  onEdit,
  children,
}: {
  label: string;
  done?: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.summaryRow}>
      <span className={`${styles.summaryDot} ${done ? styles.summaryDotDone : ''}`} aria-hidden="true" />
      <div className={styles.summaryBody}>
        <div className={styles.summaryLabelRow}>
          <span className={styles.summaryLabel}>{label}</span>
          {onEdit && (
            <button type="button" className={styles.btnLink} onClick={onEdit}>
              Edit
            </button>
          )}
        </div>
        <div className={styles.summaryValue}>{children}</div>
      </div>
    </div>
  );
}

function ResultView({
  result,
  recordId,
  engine,
  canReview,
  onGoToQueue,
  onNew,
}: {
  result: TriageResult;
  recordId: number | null;
  engine: EngineInfo | null;
  canReview: boolean;
  onGoToQueue: () => void;
  onNew: () => void;
}) {
  const level = clampLevel(result.urgency_level);
  const meta = TRIAGE_LEVELS[level];
  const diffs = result.differential_diagnoses ?? [];
  const tests = result.recommended_tests ?? [];

  return (
    <div>
      <div className={`${styles.resultBanner} ${levelClass(level)}`}>
        <div className={styles.resultLevelNum} aria-hidden="true">
          {level}
        </div>
        <div>
          <div className={styles.resultKicker}>Triage level {level} of 5</div>
          <div className={styles.resultTitle}>{meta.label}</div>
          <div className={styles.resultHint}>{meta.hint}</div>
        </div>
      </div>

      {engine?.safety_raised_from != null && (
        <Notice kind="warning">
          The AI model suggested Level {engine.safety_raised_from}. The safety rules found warning signs and raised it to Level {level}.
        </Notice>
      )}

      <div className={styles.resultSection}>
        <SectionLabel right={engine && <span className={styles.tableMuted}>{engineLabel(engine)}</span>}>Why this level</SectionLabel>
        <p className={styles.reasoningText}>{result.reasoning}</p>
      </div>

      {diffs.length > 0 && (
        <div className={styles.resultSection}>
          <SectionLabel>Possible conditions</SectionLabel>
          <div className={styles.diffList}>
            {diffs.map((d, idx) => {
              const pct = typeof d.probability === 'number' ? Math.round(d.probability <= 1 ? d.probability * 100 : d.probability) : 0;
              return (
                <div key={idx} className={styles.diffItem}>
                  <div className={styles.diffTop}>
                    <span className={styles.diffName}>{d.condition}</span>
                    <span className={styles.diffProb}>{percent(d.probability)}</span>
                  </div>
                  <div className={styles.diffBar} aria-hidden="true">
                    <div className={styles.diffBarFill} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  <div className={styles.diffRationale}>{d.rationale}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tests.length > 0 && (
        <div className={styles.resultSection}>
          <SectionLabel>Suggested tests</SectionLabel>
          <div className={styles.chipRow}>
            {tests.map((t, idx) => (
              <span key={idx} className={styles.testChip}>
                <Icon name="flask" size={13} /> {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <Notice kind="success">
        {recordId ? (
          <>
            Saved as record <strong>#{recordId}</strong> and added to the doctor review queue.
          </>
        ) : (
          'Saved to the facility database.'
        )}{' '}
        This is decision support — the attending doctor makes the final call.
      </Notice>

      <div className={styles.resultActions}>
        <button type="button" className={styles.btnPrimary} onClick={onNew}>
          <Icon name="plus" /> Triage another patient
        </button>
        {canReview && (
          <button type="button" className={styles.btnSecondary} onClick={onGoToQueue}>
            Open review queue <Icon name="arrowRight" />
          </button>
        )}
      </div>
    </div>
  );
}

function engineLabel(engine: EngineInfo): string {
  if (engine.engine === 'rules') return 'Assessed by the built-in rule engine';
  const model = engine.model ? `AI model (${engine.model})` : 'AI model';
  return `Assessed by ${model} · checked by safety rules`;
}
