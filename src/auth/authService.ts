export interface HealthcareWorker {
  userId: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  position: 'doctor' | 'nurse' | 'lab_tech' | 'pharmacist' | 'admin';
  gender: string;
}

export const STAFF_DIRECTORY: HealthcareWorker[] = [
  {
    userId: 1,
    employeeId: 'HW-DOC-001',
    firstName: 'Amina',
    lastName: 'Bello',
    gender: 'Female',
    email: 'amina.bello@hospital.lan',
    position: 'doctor',
  },
  {
    userId: 2,
    employeeId: 'HW-NUR-002',
    firstName: 'Grace',
    lastName: 'Okafor',
    gender: 'Female',
    email: 'grace.okafor@hospital.lan',
    position: 'nurse',
  },
  {
    userId: 3,
    employeeId: 'HW-NUR-003',
    firstName: 'Ibrahim',
    lastName: 'Danladi',
    gender: 'Male',
    email: 'ibrahim.danladi@hospital.lan',
    position: 'nurse',
  },
  {
    userId: 4,
    employeeId: 'HW-LAB-004',
    firstName: 'Samuel',
    lastName: 'Adeyemi',
    gender: 'Male',
    email: 'samuel.adeyemi@hospital.lan',
    position: 'lab_tech',
  },
  {
    userId: 5,
    employeeId: 'HW-ADM-005',
    firstName: 'Khadija',
    lastName: 'Umar',
    gender: 'Female',
    email: 'admin@hospital.lan',
    position: 'admin',
  },
  {
    userId: 6,
    employeeId: 'HW-DOC-006',
    firstName: 'Chukwuemeka',
    lastName: 'Obi',
    gender: 'Male',
    email: 'emeka.obi@hospital.lan',
    position: 'doctor',
  },
];

export async function loginWithCredentials(
  identifier: string,
  _password?: string,
): Promise<{ success: boolean; worker?: HealthcareWorker; error?: string }> {
  // Simulate minimal realistic authentication latency
  await new Promise((resolve) => setTimeout(resolve, 300));

  const clean = identifier.trim().toLowerCase();
  const worker = STAFF_DIRECTORY.find(
    (w) => w.employeeId.toLowerCase() === clean || w.email.toLowerCase() === clean,
  );

  if (worker) {
    return { success: true, worker };
  }

  // Fallback demo user if custom ID is entered
  return {
    success: true,
    worker: {
      userId: 99,
      employeeId: identifier.trim().toUpperCase(),
      firstName: 'Clinical',
      lastName: 'Staff',
      email: `${identifier.trim().toLowerCase()}@hospital.lan`,
      position: identifier.toLowerCase().includes('doc') ? 'doctor' : 'nurse',
      gender: 'Unspecified',
    },
  };
}
