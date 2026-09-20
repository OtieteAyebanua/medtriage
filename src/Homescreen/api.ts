export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadPatientPhoto(patientId: number, file: File): Promise<{ photo_path: string }> {
  // Mock photo upload
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ photo_path: URL.createObjectURL(file) });
    }, 500);
  });
}
