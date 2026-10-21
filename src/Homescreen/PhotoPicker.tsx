'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './Homescreen.module.css';
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES } from '@/api';
import { Avatar, Icon } from './shared';

interface Props {
  patientId: number;
  firstName?: string;
  lastName?: string;
  /** Current stored photo (for the preview when nothing new is picked) */
  photoPath?: string | null;
  /** Called with the chosen file, or null when the user clears the selection */
  onChange: (file: File | null) => void;
  /** Called when the user asks to remove an existing stored photo */
  onRemove?: () => void;
  size?: number;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Photo chooser with live preview. On phones/tablets the file input offers the
 * camera directly; on desktop it opens the file browser.
 */
export default function PhotoPicker({
  patientId,
  firstName,
  lastName,
  photoPath,
  onChange,
  onRemove,
  size = 88,
  disabled,
  busy,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (file: File | null) => {
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }
    if (!PHOTO_ACCEPT.split(',').includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError('Photo must be 5 MB or smaller.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const hasStored = !!photoPath && !preview;

  return (
    <div className={styles.photoPicker}>
      <div className={styles.photoPreview} style={{ width: size, height: size }}>
        {preview ? (
          <img src={preview} alt="Selected photo preview" />
        ) : (
          <Avatar patientId={patientId} firstName={firstName} lastName={lastName} photoPath={photoPath} size={size} />
        )}
        {busy && <span className={styles.photoBusy} aria-label="Uploading" />}
      </div>
      <div className={styles.photoActions}>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPT}
          className={styles.srOnly}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          disabled={disabled}
        />
        <button type="button" className={styles.btnSecondary} onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Icon name="camera" /> {preview || hasStored ? 'Change photo' : 'Add photo'}
        </button>
        {preview && (
          <button
            type="button"
            className={styles.btnLink}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = '';
              pick(null);
            }}
            disabled={disabled}
          >
            Clear selection
          </button>
        )}
        {hasStored && onRemove && (
          <button type="button" className={`${styles.btnLink} ${styles.textDanger}`} onClick={onRemove} disabled={disabled}>
            Remove photo
          </button>
        )}
        <span className={styles.inputHint}>JPEG, PNG or WebP · up to 5 MB</span>
        {error && <span className={styles.fieldError}>{error}</span>}
      </div>
    </div>
  );
}
