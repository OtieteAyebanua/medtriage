import { errorMessage, login } from '../api';

export interface HealthcareWorker {
  userId: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  employeeId: string;
  email: string;
  position: 'doctor' | 'nurse' | 'lab_tech' | 'pharmacist' | 'admin';
  gender: string;
}

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<{ success: boolean; worker?: HealthcareWorker; error?: string }> {
  try {
    const worker = await login(identifier.trim(), password);
    return { success: true, worker };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Sign-in failed. Please try again.') };
  }
}
