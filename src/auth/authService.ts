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

/** Accounts behind the "Quick Demo Sign-In" buttons. They exist in the server's demo data (password demo123). */
export const STAFF_DIRECTORY: Array<Pick<HealthcareWorker, 'employeeId' | 'firstName' | 'lastName' | 'position'>> = [
  { employeeId: 'HW-DOC-001', firstName: 'Amina', lastName: 'Bello', position: 'doctor' },
  { employeeId: 'HW-NUR-002', firstName: 'Grace', lastName: 'Okafor', position: 'nurse' },
];

export const DEMO_PASSWORD = 'demo123';

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
