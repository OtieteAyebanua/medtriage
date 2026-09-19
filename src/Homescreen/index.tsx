'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Homescreen.module.css';
import { apiFetch, UNAUTHENTICATED_EVENT } from './api';
import { Icon, IconName, ToastStack } from './shared';
import { fullName } from './clinical';
import TriageWizard, { PatientRequest } from './TriageWizard';
import PatientsTab from './PatientsTab';
import ReportsTab from './ReportsTab';
import QueueTab from './QueueTab';
import RegisterPatientModal from './RegisterPatientModal';
import PatientHistoryModal from './PatientHistoryModal';
import { HealthcareWorker, PatientItem, QueueRecord, SymptomItem, Tab, ToastMessage, WardReport } from './types';

export type { HealthcareWorker, PatientItem, SymptomItem } from './types';

export interface HomescreenProps {
  currentUser?: HealthcareWorker | null;
  onLogout?: () => void;
}

const POSITION_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  nurse: 'Nurse',
  lab_tech: 'Lab technician',
  pharmacist: 'Pharmacist',
  admin: 'Administrator',
};

export default function Homescreen({ currentUser, onLogout }: HomescreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('triage');

  // Normalize the worker record (API and cached copies use different casings)
  const workerUserId = currentUser?.userId ?? currentUser?.user_id ?? 1;
  const workerFirstName = currentUser?.firstName ?? currentUser?.first_name ?? '';
  const workerLastName = currentUser?.lastName ?? currentUser?.last_name ?? '';
  const workerEmployeeId = currentUser?.employeeId ?? currentUser?.employee_id ?? '';
  const workerPosition = (currentUser?.position ?? 'nurse').toLowerCase();
  const isDoctor = workerPosition === 'doctor';
  const displayName = `${isDoctor ? 'Dr. ' : ''}${workerFirstName} ${workerLastName}`.trim();

  // Shared data
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [wardReport, setWardReport] = useState<WardReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [queue, setQueue] = useState<QueueRecord[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // Cross-tab coordination
  const [showRegModal, setShowRegModal] = useState(false);
  const regSourceRef = useRef<'triage' | 'patients'>('patients');
  const [patientRequest, setPatientRequest] = useState<PatientRequest | null>(null);
  const [historyPatientId, setHistoryPatientId] = useState<number | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const res = await apiFetch('/api/patients');
      const data = await res.json();
      if (data.patients) setPatients(data.patients);
    } catch (e) {
      console.error('Failed loading patients', e);
      toast('error', 'Could not load the patient registry.');
    } finally {
      setPatientsLoading(false);
    }
  }, [toast]);

  const loadSymptoms = useCallback(async () => {
    try {
      const res = await apiFetch('/api/symptoms');
      const data = await res.json();
      if (data.symptoms) setSymptoms(data.symptoms);
    } catch (e) {
      console.error('Failed loading symptoms', e);
      toast('error', 'Could not load the symptom catalogue.');
    }
  }, [toast]);

  const loadWardReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await apiFetch('/api/reports/ward');
      const data = await res.json();
      if (data.status === 'success') setWardReport(data);
    } catch (e) {
      console.error('Failed loading ward report', e);
    } finally {
      setReportLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await apiFetch('/api/records/queue');
      const data = await res.json();
      if (data.success && data.queue) setQueue(data.queue);
    } catch (e) {
      console.error('Failed loading clinical queue', e);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
    loadSymptoms();
    loadWardReport();
    loadQueue();
  }, [loadPatients, loadSymptoms, loadWardReport, loadQueue]);

  // Session expired or revoked → back to the login screen
  useEffect(() => {
    if (!onLogout) return;
    const handler = () => onLogout();
    window.addEventListener(UNAUTHENTICATED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, handler);
  }, [onLogout]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'reports') loadWardReport();
    if (tab === 'queue') loadQueue();
  };

  const openRegister = (source: 'triage' | 'patients') => {
    regSourceRef.current = source;
    setShowRegModal(true);
  };

  const handleRegistered = (patient: PatientItem) => {
    setPatients((prev) => [patient, ...prev]);
    setShowRegModal(false);
    toast('success', `${fullName(patient)} registered.`);
    // Registered from the wizard → select them there; from the registry → offer to start triage.
    if (regSourceRef.current === 'triage') {
      setPatientRequest({ patientId: patient.patient_id, reset: false, nonce: Date.now() });
    }
  };

  const startTriageFor = (patientId: number) => {
    setHistoryPatientId(null);
    setPatientRequest({ patientId, reset: true, nonce: Date.now() });
    setActiveTab('triage');
  };

  const tabs: Array<{ id: Tab; label: string; icon: IconName; badge?: number; badgeUrgent?: boolean }> = [
    { id: 'triage', label: 'New triage', icon: 'stethoscope' },
    { id: 'patients', label: 'Patients', icon: 'users', badge: patients.length || undefined },
    { id: 'reports', label: 'Ward overview', icon: 'chart' },
  ];
  if (isDoctor) {
    tabs.push({ id: 'queue', label: 'Review queue', icon: 'clipboard', badge: queue.length || undefined, badgeUrgent: true });
  }

  return (
    <div className={styles.app}>
      <header className={styles.topHeader}>
        <div className={styles.brandGroup}>
          <span className={styles.brandTitle}>
            MedTriage <span className={styles.brandAccent}>AI</span>
          </span>
          <span className={styles.lanBadge} title="Runs on the facility's local network — no internet needed">
            <span className={styles.pulseDot} aria-hidden="true" />
            Facility LAN
          </span>
        </div>

        <div className={styles.userGroup}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{displayName || 'Signed in'}</div>
            <div className={styles.userRole}>
              {POSITION_LABEL[workerPosition] ?? workerPosition}
              {workerEmployeeId ? ` · ${workerEmployeeId}` : ''}
            </div>
          </div>
          {onLogout && (
            <button type="button" className={styles.btnSecondary} onClick={onLogout} title="Sign out">
              <Icon name="logout" /> <span className={styles.hideOnMobile}>Sign out</span>
            </button>
          )}
        </div>
      </header>

      <nav className={styles.tabBar} aria-label="Main">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => switchTab(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} size={17} />
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span className={`${styles.tabBadge} ${t.badgeUrgent ? styles.tabBadgeUrgent : ''}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        {/* The wizard stays mounted so an in-progress assessment survives tab switches. */}
        <div hidden={activeTab !== 'triage'}>
          <TriageWizard
            patients={patients}
            symptoms={symptoms}
            workerUserId={workerUserId}
            canReview={isDoctor}
            patientRequest={patientRequest}
            onRegister={() => openRegister('triage')}
            onViewHistory={setHistoryPatientId}
            onTriageSaved={() => {
              loadPatients(); // refresh "last seen" summaries
              loadWardReport();
              loadQueue();
            }}
            onGoToQueue={() => switchTab('queue')}
          />
        </div>

        {activeTab === 'patients' && (
          <PatientsTab
            patients={patients}
            loading={patientsLoading}
            onRegister={() => openRegister('patients')}
            onStartTriage={startTriageFor}
            onViewHistory={setHistoryPatientId}
            onPatientUpdated={(updated) => {
              setPatients((prev) => prev.map((p) => (p.patient_id === updated.patient_id ? { ...p, ...updated } : p)));
              toast('success', 'Photo saved.');
            }}
            onError={(message) => toast('error', message)}
          />
        )}

        {activeTab === 'reports' && <ReportsTab report={wardReport} loading={reportLoading} onRefresh={loadWardReport} />}

        {activeTab === 'queue' && isDoctor && (
          <QueueTab
            queue={queue}
            loading={queueLoading}
            workerUserId={workerUserId}
            onRefresh={loadQueue}
            onReviewed={(record) => {
              toast('success', `Review for ${record.patientName} saved.`);
              loadQueue();
              loadWardReport();
              loadPatients();
            }}
          />
        )}
      </main>

      {showRegModal && <RegisterPatientModal onClose={() => setShowRegModal(false)} onRegistered={handleRegistered} />}

      {historyPatientId !== null && (
        <PatientHistoryModal patientId={historyPatientId} onClose={() => setHistoryPatientId(null)} onStartTriage={startTriageFor} />
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
