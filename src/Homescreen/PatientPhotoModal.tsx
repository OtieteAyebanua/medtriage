import React, { useState } from 'react';
import styles from './Homescreen.module.css';
import { errorMessage, removePatientPhoto, uploadPatientPhoto } from '@/api';
import { fullName } from './clinical';
import PhotoPicker from './PhotoPicker';
import { Modal, Notice, Spinner } from './shared';
import { PatientItem } from './types';

interface Props {
  patient: PatientItem;
  onClose: () => void;
  /** Called with the updated patient and a message for the toast */
  onSaved: (patient: PatientItem, message: string) => void;
}

/** Add, change or remove a registered patient's photo (opened from the avatar on the Patients tab). */
export default function PatientPhotoModal({ patient, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState<'saving' | 'removing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = fullName(patient);

  const save = async () => {
    if (!file) return;
    setBusy('saving');
    setError(null);
    try {
      onSaved(await uploadPatientPhoto(patient.patient_id, file), `Photo of ${name} saved.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the photo.'));
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('removing');
    setError(null);
    try {
      onSaved(await removePatientPhoto(patient.patient_id), `Photo of ${name} removed.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not remove the photo.'));
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  return (
    <Modal
      title={patient.photo_path ? 'Patient photo' : 'Add patient photo'}
      subtitle={`${name} · ID #${patient.patient_id}`}
      onClose={onClose}
      locked={busy !== null}
      footer={
        <>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy !== null}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={save} disabled={!file || busy !== null}>
            {busy === 'saving' ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              'Save photo'
            )}
          </button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <PhotoPicker
        patientId={patient.patient_id}
        firstName={patient.first_name}
        lastName={patient.last_name}
        photoPath={patient.photo_path}
        onChange={(picked) => {
          setFile(picked);
          setConfirmRemove(false);
        }}
        onRemove={() => setConfirmRemove(true)}
        size={120}
        disabled={busy !== null}
        busy={busy !== null}
      />

      {confirmRemove && (
        <Notice kind="warning" role="alert">
          <div>Remove this photo? {name} will show their initials instead. This can't be undone.</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
            <button type="button" className={styles.btnDanger} onClick={remove} disabled={busy !== null}>
              {busy === 'removing' ? (
                <>
                  <Spinner /> Removing…
                </>
              ) : (
                'Remove photo'
              )}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => setConfirmRemove(false)} disabled={busy !== null}>
              Keep it
            </button>
          </div>
        </Notice>
      )}
    </Modal>
  );
}
