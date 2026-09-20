import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Homescreen.module.css';
import { Icon, IconName, ToastStack } from './shared';
import { fullName } from './clinical';
import TriageWizard, { PatientRequest } from './TriageWizard';
import PatientsTab from './PatientsTab';
import ReportsTab from './ReportsTab';
import QueueTab from './QueueTab';
import RegisterPatientModal from './RegisterPatientModal';
import PatientHistoryModal from './PatientHistoryModal';
import { HealthcareWorker, PatientItem, QueueRecord, SymptomItem, Tab, ToastMessage, WardReport } from './types';
import { INITIAL_PATIENTS, INITIAL_QUEUE, INITIAL_SYMPTOMS, INITIAL_WARD_REPORT } from './mockData';

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

const PATIENTS_STORAGE_KEY = 'medtriage_patients';
const QUEUE_STORAGE_KEY = 'medtriage_queue';

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

  // Shared data initialized with rich clinical demo records
  const [patients, setPatients] = useState<PatientItem[]>(() => {
    try {
      const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_PATIENTS;
  });
  const [patientsLoading, setPatientsLoading] = useState(false);

  const [symptoms] = useState<SymptomItem[]>(INITIAL_SYMPTOMS);

  const [wardReport, setWardReport] = useState<WardReport | null>(INITIAL_WARD_REPORT);
  const [reportLoading, setReportLoading] = useState(false);

  const [queue, setQueue] = useState<QueueRecord[]>(() => {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_QUEUE;
  });
  const [queueLoading, setQueueLoading] = useState(false);

  // Cross-tab coordination
  const [showRegModal, setShowRegModal] = useState(false);
  const regSourceRef = useRef<'triage' | 'patients'>('patients');
  const [patientRequest, setPatientRequest] = useState<PatientRequest | null>(null);
  const [historyPatientId, setHistoryPatientId] = useState<number | null>(null);

  // Persist patient additions
  const updatePatientsList = useCallback((updater: (prev: PatientItem[]) => PatientItem[]) => {
    setPatients((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Persist queue updates
  const updateQueueList = useCallback((updater: (prev: QueueRecord[]) => QueueRecord[]) => {
    setQueue((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const loadPatients = useCallback(async () => {
    setPatientsLoading(false);
  }, []);

  const loadWardReport = useCallback(async () => {
    setReportLoading(false);
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(false);
  }, []);

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
    updatePatientsList((prev) => [patient, ...prev]);
    setShowRegModal(false);
    toast('success', `${fullName(patient)} registered.`);
    if (regSourceRef.current === 'triage') {
      setPatientRequest({ patientId: patient.patient_id, reset: false, nonce: Date.now() });
    }
  };

  const startTriageFor = (patientId: number) => {
    setHistoryPatientId(null);
    setPatientRequest({ patientId, reset: true, nonce: Date.now() });
    setActiveTab('triage');
  };

  const handleQueueReview = (record: QueueRecord) => {
    updateQueueList((prev) => prev.filter((q) => q.recordId !== record.recordId));
    setWardReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        awaiting_review: Math.max(0, prev.awaiting_review - 1),
        review_stats: {
          ...prev.review_stats,
          reviewed: prev.review_stats.reviewed + 1,
          pending: Math.max(0, prev.review_stats.pending - 1),
        },
      };
    });
    toast('success', `Review for ${record.patientName} saved.`);
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
              loadPatients();
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
              updatePatientsList((prev) => prev.map((p) => (p.patient_id === updated.patient_id ? { ...p, ...updated } : p)));
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
            onReviewed={handleQueueReview}
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
