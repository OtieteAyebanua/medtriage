/**
 * MedTriage AI — demo seed
 *
 * Populates every table with realistic, deterministic demo data:
 *   - 8 healthcare workers (2 doctors, 3 nurses, lab tech, pharmacist, admin)
 *   - 32-symptom catalogue across 9 body systems
 *   - 20 patients (infants to elderly) with placeholder photos
 *   - ~45 visits over the last 30 days, run through the triage engine, with
 *     doctor reviews, overrides, diagnoses and a live review queue
 *
 * Modes
 *   npm run prisma:seed          upsert workers + symptoms; add demo patients/visits only if the DB has no patients
 *   npm run seed:demo            SEED_RESET=1 — wipe patients, visits, sessions and photos, then rebuild the demo
 *
 * All demo staff share the password in SEED_PASSWORD (default "password123").
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateTriage } from '../src/lib/triage-engine';
import { makeDemoPortrait } from './demo-photo';

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'password123';
const RESET = process.env.SEED_RESET === '1';
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

// Deterministic PRNG so every demo install looks the same
let rngState = 20260919;
const rand = () => {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const round = (n: number, dp = 0) => Number(n.toFixed(dp));
const daysAgo = (days: number, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/* ------------------------------------------------------------------ */
/* Table 3.3.3.1 — Healthcare workers                                  */
/* ------------------------------------------------------------------ */
const WORKERS = [
  { employee_id: 'HW-DOC-001', first_name: 'Amina', middle_name: 'Fatima', last_name: 'Bello', gender: 'Female', email: 'amina.bello@hospital.lan', position: 'doctor' },
  { employee_id: 'HW-NUR-002', first_name: 'Grace', middle_name: 'Chioma', last_name: 'Okafor', gender: 'Female', email: 'grace.okafor@hospital.lan', position: 'nurse' },
  { employee_id: 'HW-NUR-003', first_name: 'Ibrahim', middle_name: 'Musa', last_name: 'Danladi', gender: 'Male', email: 'ibrahim.danladi@hospital.lan', position: 'nurse' },
  { employee_id: 'HW-LAB-004', first_name: 'Samuel', middle_name: 'Olu', last_name: 'Adeyemi', gender: 'Male', email: 'samuel.adeyemi@hospital.lan', position: 'lab_tech' },
  { employee_id: 'HW-ADM-005', first_name: 'Khadija', middle_name: 'Zainab', last_name: 'Umar', gender: 'Female', email: 'admin@hospital.lan', position: 'admin' },
  { employee_id: 'HW-DOC-006', first_name: 'Chukwuemeka', middle_name: null, last_name: 'Obi', gender: 'Male', email: 'emeka.obi@hospital.lan', position: 'doctor' },
  { employee_id: 'HW-NUR-007', first_name: 'Halima', middle_name: 'Abubakar', last_name: 'Sadiq', gender: 'Female', email: 'halima.sadiq@hospital.lan', position: 'nurse' },
  { employee_id: 'HW-PHA-008', first_name: 'Tunde', middle_name: 'Olawale', last_name: 'Bakare', gender: 'Male', email: 'tunde.bakare@hospital.lan', position: 'pharmacist' },
];

/* ------------------------------------------------------------------ */
/* Table 3.3.3.4 — Symptom catalogue                                    */
/* ------------------------------------------------------------------ */
const SYMPTOMS = [
  // Systemic
  { symptom_name: 'High Fever', category: 'systemic', severity_scale: 4, description: 'Elevated core body temperature above 38.5°C', related_conditions: 'Malaria, Typhoid Fever, Sepsis, Meningitis', synonyms: 'pyrexia, hot body, chills, temperature', follow_up_questions: 'Is the fever intermittent or continuous? Any rigors or shivering? Has the patient taken antimalarials?' },
  { symptom_name: 'Generalised Weakness / Fatigue', category: 'systemic', severity_scale: 2, description: 'Marked loss of energy and reduced ability to perform usual activities', related_conditions: 'Anaemia, Malaria, Dehydration, Diabetes', synonyms: 'tiredness, body weakness, malaise, lethargy', follow_up_questions: 'How many days has it lasted? Any weight loss? Is the patient eating normally?' },
  { symptom_name: 'Loss of Appetite', category: 'systemic', severity_scale: 1, description: 'Reduced desire to eat over several days', related_conditions: 'Typhoid Fever, Hepatitis, Depression', synonyms: 'anorexia, not eating, poor feeding', follow_up_questions: 'How long has the patient eaten less than usual? Any nausea with it?' },
  { symptom_name: 'Excessive Sweating / Night Sweats', category: 'systemic', severity_scale: 2, description: 'Drenching sweats, especially at night', related_conditions: 'Tuberculosis, Malaria, Lymphoma', synonyms: 'sweating at night, drenching sweat', follow_up_questions: 'Do the sweats soak the bedding? Any cough longer than 2 weeks? Any weight loss?' },
  // Neurological
  { symptom_name: 'Severe Headache', category: 'neurological', severity_scale: 3, description: 'Intense, persistent head pain', related_conditions: 'Meningitis, Malaria, Hypertensive crisis, Migraine', synonyms: 'head pain, migraine, throbbing head', follow_up_questions: 'Is it the worst headache of the patient’s life? Sudden or gradual onset? Any visual changes or vomiting?' },
  { symptom_name: 'Neck Stiffness (Nuchal Rigidity)', category: 'neurological', severity_scale: 5, description: 'Painful resistance to passive neck flexion', related_conditions: 'Meningitis, Subarachnoid haemorrhage', synonyms: 'stiff neck, cannot bend neck, nuchal rigidity', follow_up_questions: 'Can the patient touch chin to chest? Any sensitivity to light? Any rash?' },
  { symptom_name: 'Altered Consciousness / Confusion', category: 'neurological', severity_scale: 5, description: 'Reduced alertness, disorientation or unresponsiveness', related_conditions: 'Cerebral malaria, Meningitis, Hypoglycaemia, Sepsis, Stroke', synonyms: 'confused, drowsy, unconscious, not responding, coma, collapsed', follow_up_questions: 'Does the patient respond to voice or pain? Any history of diabetes? Any recent seizures or head injury?' },
  { symptom_name: 'Seizures / Convulsions', category: 'neurological', severity_scale: 5, description: 'Episodes of uncontrolled shaking or loss of consciousness', related_conditions: 'Cerebral malaria, Epilepsy, Febrile convulsion, Eclampsia', synonyms: 'fits, convulsing, shaking, epilepsy', follow_up_questions: 'How long did the fit last? Is it the first episode? Was there fever before it? Is the patient pregnant?' },
  { symptom_name: 'Dizziness / Fainting', category: 'neurological', severity_scale: 3, description: 'Light-headedness or brief loss of consciousness', related_conditions: 'Anaemia, Dehydration, Hypotension, Arrhythmia', synonyms: 'faint, light-headed, syncope, vertigo, collapsed', follow_up_questions: 'Did the patient fully lose consciousness? Does it happen on standing? Any palpitations?' },
  { symptom_name: 'Weakness on One Side of Body', category: 'neurological', severity_scale: 5, description: 'Sudden unilateral limb or facial weakness', related_conditions: 'Stroke, Transient ischaemic attack', synonyms: 'hemiparesis, face drooping, cannot move arm, slurred speech', follow_up_questions: 'When exactly did it start? Any facial droop or speech difficulty? Known hypertension?' },
  // Respiratory
  { symptom_name: 'Shortness of Breath (Dyspnea)', category: 'respiratory', severity_scale: 4, description: 'Difficulty breathing or breathlessness at rest or on exertion', related_conditions: 'Pneumonia, Asthma, Heart failure, Anaemia', synonyms: 'breathless, cannot breathe, difficulty breathing, dyspnea, dyspnoea', follow_up_questions: 'Does it occur at rest or only on exertion? Any wheeze? Can the patient speak in full sentences?' },
  { symptom_name: 'Persistent Cough', category: 'respiratory', severity_scale: 2, description: 'Cough lasting more than one week', related_conditions: 'Pneumonia, Tuberculosis, Bronchitis, Asthma', synonyms: 'coughing, chesty cough, dry cough', follow_up_questions: 'Is it productive? Any blood in the sputum? Longer than 2 weeks? Any TB contact?' },
  { symptom_name: 'Coughing up Blood', category: 'respiratory', severity_scale: 4, description: 'Blood in sputum (haemoptysis)', related_conditions: 'Tuberculosis, Pneumonia, Pulmonary embolism', synonyms: 'haemoptysis, hemoptysis, blood in sputum, blood when coughing', follow_up_questions: 'How much blood — streaks or cupfuls? Any weight loss or night sweats?' },
  { symptom_name: 'Wheezing', category: 'respiratory', severity_scale: 3, description: 'High-pitched whistling sound on breathing out', related_conditions: 'Asthma, COPD, Bronchiolitis, Allergic reaction', synonyms: 'whistling chest, tight chest, noisy breathing', follow_up_questions: 'Known asthma? Any inhaler used today? Any recent exposure to smoke or dust?' },
  { symptom_name: 'Sore Throat', category: 'respiratory', severity_scale: 1, description: 'Pain or scratchiness in the throat', related_conditions: 'Pharyngitis, Tonsillitis, Common cold', synonyms: 'throat pain, painful swallowing', follow_up_questions: 'Difficulty swallowing? Any white patches on the tonsils? Any fever?' },
  // Cardiac
  { symptom_name: 'Chest Pain', category: 'cardiac', severity_scale: 5, description: 'Pressure, tightness or pain in the chest', related_conditions: 'Acute coronary syndrome, Pneumonia, Pulmonary embolism, Pericarditis', synonyms: 'chest tightness, chest pressure, heart pain', follow_up_questions: 'Does it spread to the arm, jaw or back? Worse on breathing in? Any sweating or nausea with it?' },
  { symptom_name: 'Palpitations', category: 'cardiac', severity_scale: 3, description: 'Awareness of fast, irregular or pounding heartbeat', related_conditions: 'Arrhythmia, Anaemia, Thyrotoxicosis, Anxiety', synonyms: 'racing heart, heart pounding, irregular heartbeat', follow_up_questions: 'Is the beat regular or irregular? Any dizziness or chest pain with it? Caffeine or stimulant use?' },
  { symptom_name: 'Swollen Legs / Ankles', category: 'cardiac', severity_scale: 2, description: 'Bilateral pitting oedema of the lower limbs', related_conditions: 'Heart failure, Kidney disease, Pre-eclampsia, Liver disease', synonyms: 'oedema, edema, swollen feet, puffy legs', follow_up_questions: 'Both legs or one? Any breathlessness lying flat? Is the patient pregnant?' },
  // Gastrointestinal
  { symptom_name: 'Severe Abdominal Pain', category: 'gastrointestinal', severity_scale: 4, description: 'Intense pain anywhere in the abdomen', related_conditions: 'Appendicitis, Typhoid perforation, Ectopic pregnancy, Intestinal obstruction', synonyms: 'stomach pain, belly pain, tummy ache, abdominal cramps', follow_up_questions: 'Where exactly is the pain? Is the abdomen rigid or tender? Last menstrual period? Passing stool and gas?' },
  { symptom_name: 'Persistent Vomiting', category: 'gastrointestinal', severity_scale: 3, description: 'Repeated vomiting over several hours', related_conditions: 'Gastroenteritis, Malaria, Intestinal obstruction, Pregnancy', synonyms: 'throwing up, vomit, emesis, being sick', follow_up_questions: 'How many times today? Any blood or bile? Can the patient keep fluids down?' },
  { symptom_name: 'Profuse Diarrhea', category: 'gastrointestinal', severity_scale: 3, description: 'Three or more loose or watery stools in 24 hours', related_conditions: 'Gastroenteritis, Cholera, Typhoid, Dysentery', synonyms: 'loose stools, watery stool, running stomach, purging', follow_up_questions: 'How many stools today? Any blood or mucus? Is the patient passing urine normally? Rice-water appearance?' },
  { symptom_name: 'Blood in Stool', category: 'gastrointestinal', severity_scale: 4, description: 'Visible fresh or dark blood in faeces', related_conditions: 'Dysentery, Peptic ulcer, Haemorrhoids, Typhoid', synonyms: 'bloody stool, melaena, melena, black stool', follow_up_questions: 'Bright red or black and tarry? Any abdominal pain? Any NSAID use?' },
  { symptom_name: 'Yellow Eyes / Skin (Jaundice)', category: 'gastrointestinal', severity_scale: 3, description: 'Yellow discolouration of sclera or skin', related_conditions: 'Hepatitis, Severe malaria, Sickle cell crisis, Biliary obstruction', synonyms: 'jaundice, yellow eyes, yellow skin', follow_up_questions: 'Dark urine or pale stools? Any itching? Any alcohol or herbal medicine use?' },
  { symptom_name: 'Signs of Dehydration', category: 'gastrointestinal', severity_scale: 4, description: 'Sunken eyes, dry mouth, reduced skin turgor or reduced urine output', related_conditions: 'Gastroenteritis, Cholera, Diabetic ketoacidosis', synonyms: 'dehydrated, sunken eyes, dry mouth, not passing urine', follow_up_questions: 'When did the patient last pass urine? Is the patient drinking? Is the child lethargic?' },
  // Musculoskeletal
  { symptom_name: 'Joint Pain / Swelling', category: 'musculoskeletal', severity_scale: 2, description: 'Pain, warmth or swelling in one or more joints', related_conditions: 'Sickle cell crisis, Septic arthritis, Rheumatoid arthritis, Gout', synonyms: 'arthralgia, painful joints, swollen knee', follow_up_questions: 'One joint or many? Any fever? Known sickle cell disease?' },
  { symptom_name: 'Bone Pain (Sickle Cell Crisis)', category: 'musculoskeletal', severity_scale: 4, description: 'Severe deep bone pain in a known sickle cell patient', related_conditions: 'Vaso-occlusive crisis, Osteomyelitis', synonyms: 'crisis, bone pain, sickle cell pain', follow_up_questions: 'Where is the pain? Any chest pain or breathlessness (acute chest syndrome)? Fluid intake today?' },
  { symptom_name: 'Injury / Trauma', category: 'musculoskeletal', severity_scale: 3, description: 'Recent physical injury, fall, road traffic accident or assault', related_conditions: 'Fracture, Head injury, Internal bleeding', synonyms: 'accident, fall, wound, fracture, RTA', follow_up_questions: 'How did it happen? Any loss of consciousness? Any bleeding that will not stop? Can the patient bear weight?' },
  // Dermatological
  { symptom_name: 'Skin Rash', category: 'dermatological', severity_scale: 2, description: 'New rash anywhere on the body', related_conditions: 'Measles, Chickenpox, Drug reaction, Meningococcal sepsis', synonyms: 'spots, skin eruption, hives, itchy skin', follow_up_questions: 'Does the rash fade when pressed with a glass? Any fever? Any new medicines? Any contact with measles?' },
  { symptom_name: 'Wound / Abscess', category: 'dermatological', severity_scale: 2, description: 'Open wound, boil or collection of pus', related_conditions: 'Cellulitis, Abscess, Tetanus risk', synonyms: 'boil, pus, sore, ulcer, cut', follow_up_questions: 'How old is the wound? Any spreading redness? Tetanus vaccination up to date?' },
  // Genitourinary / obstetric
  { symptom_name: 'Painful Urination', category: 'genitourinary', severity_scale: 2, description: 'Burning or pain when passing urine', related_conditions: 'Urinary tract infection, STI, Schistosomiasis', synonyms: 'dysuria, burning urine, frequent urination', follow_up_questions: 'Any blood in the urine? Any flank pain or fever? Any discharge?' },
  { symptom_name: 'Vaginal Bleeding in Pregnancy', category: 'obstetric', severity_scale: 5, description: 'Any bleeding per vaginam in a pregnant woman', related_conditions: 'Miscarriage, Ectopic pregnancy, Placenta praevia, Abruption', synonyms: 'bleeding pregnant, spotting, antepartum haemorrhage', follow_up_questions: 'How many weeks pregnant? How heavy is the bleeding? Any abdominal pain? Any dizziness?' },
  { symptom_name: 'Labour Pains / Contractions', category: 'obstetric', severity_scale: 4, description: 'Regular painful uterine contractions', related_conditions: 'Labour, Preterm labour, Placental abruption', synonyms: 'contractions, in labour, waters broken', follow_up_questions: 'How many weeks pregnant? How far apart are the contractions? Have the waters broken? Is the baby moving?' },
  // ENT / eyes
  { symptom_name: 'Ear Pain / Discharge', category: 'ent', severity_scale: 1, description: 'Pain in the ear or fluid draining from the ear canal', related_conditions: 'Otitis media, Otitis externa', synonyms: 'earache, ear discharge, pus from ear', follow_up_questions: 'One ear or both? Any fever? Any hearing loss?' },
];

/* ------------------------------------------------------------------ */
/* Table 3.3.3.2 — Patients                                             */
/* ------------------------------------------------------------------ */
interface DemoPatient {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  dob: string;
  gender: 'Male' | 'Female';
  blood_type: string;
  email?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
}

const PATIENTS: DemoPatient[] = [
  { first_name: 'Musa', middle_name: 'Aliyu', last_name: 'Garba', dob: '1994-05-12', gender: 'Male', blood_type: 'O+', email: 'musa.garba@example.com', allergies: 'Penicillin', chronic_conditions: 'Hypertension' },
  { first_name: 'Blessing', middle_name: 'Ngozi', last_name: 'Eze', dob: '2001-11-23', gender: 'Female', blood_type: 'B+', email: 'blessing.eze@example.com', allergies: null, chronic_conditions: 'Asthma' },
  { first_name: 'Emeka', middle_name: 'Chukwudi', last_name: 'Nwosu', dob: '2018-03-08', gender: 'Male', blood_type: 'A+', allergies: 'Sulfa drugs', chronic_conditions: 'Sickle Cell Disease (HbSS)' },
  { first_name: 'Aisha', middle_name: 'Mohammed', last_name: 'Yusuf', dob: '1987-09-02', gender: 'Female', blood_type: 'O-', email: 'aisha.yusuf@example.com', allergies: null, chronic_conditions: 'Type 2 Diabetes' },
  { first_name: 'Chinedu', middle_name: null, last_name: 'Okonkwo', dob: '1959-01-17', gender: 'Male', blood_type: 'AB+', allergies: 'NSAIDs (Ibuprofen)', chronic_conditions: 'Hypertension, Chronic kidney disease stage 2' },
  { first_name: 'Fatima', middle_name: 'Hauwa', last_name: 'Abdullahi', dob: '1998-07-30', gender: 'Female', blood_type: 'A-', email: 'fatima.abdullahi@example.com', allergies: null, chronic_conditions: null },
  { first_name: 'Oluwaseun', middle_name: 'Adebayo', last_name: 'Adeyinka', dob: '1976-12-05', gender: 'Male', blood_type: 'B-', allergies: null, chronic_conditions: 'Peptic ulcer disease' },
  { first_name: 'Ngozi', middle_name: 'Adaeze', last_name: 'Okoro', dob: '2023-06-14', gender: 'Female', blood_type: 'O+', allergies: null, chronic_conditions: null },
  { first_name: 'Ibrahim', middle_name: null, last_name: 'Suleiman', dob: '1948-04-21', gender: 'Male', blood_type: 'O+', allergies: 'Aspirin', chronic_conditions: 'Hypertension, Benign prostatic hyperplasia' },
  { first_name: 'Chiamaka', middle_name: 'Precious', last_name: 'Uche', dob: '2010-10-09', gender: 'Female', blood_type: 'A+', email: 'chiamaka.uche@example.com', allergies: 'Peanuts', chronic_conditions: 'Asthma' },
  { first_name: 'Yakubu', middle_name: 'Danjuma', last_name: 'Bala', dob: '1982-02-28', gender: 'Male', blood_type: 'B+', allergies: null, chronic_conditions: null },
  { first_name: 'Halimat', middle_name: 'Sadia', last_name: 'Lawal', dob: '1996-08-19', gender: 'Female', blood_type: 'O+', email: 'halimat.lawal@example.com', allergies: null, chronic_conditions: 'Pregnant — 28 weeks (G2P1)' },
  { first_name: 'Tochukwu', middle_name: null, last_name: 'Anyanwu', dob: '2016-05-03', gender: 'Male', blood_type: 'AB-', allergies: null, chronic_conditions: 'Sickle Cell Disease (HbSS)' },
  { first_name: 'Rukayat', middle_name: 'Omolara', last_name: 'Balogun', dob: '1969-11-11', gender: 'Female', blood_type: 'A+', allergies: 'Latex', chronic_conditions: 'Type 2 Diabetes, Hypertension' },
  { first_name: 'Samuel', middle_name: 'Ikechukwu', last_name: 'Nnamdi', dob: '2004-01-25', gender: 'Male', blood_type: 'O+', email: 'samuel.nnamdi@example.com', allergies: null, chronic_conditions: null },
  { first_name: 'Maryam', middle_name: null, last_name: 'Idris', dob: '1991-03-15', gender: 'Female', blood_type: 'B+', allergies: 'Chloroquine', chronic_conditions: null },
  { first_name: 'Abubakar', middle_name: 'Sani', last_name: 'Tanko', dob: '2021-09-27', gender: 'Male', blood_type: 'A+', allergies: null, chronic_conditions: null },
  { first_name: 'Ifeoma', middle_name: 'Grace', last_name: 'Chukwu', dob: '1953-07-07', gender: 'Female', blood_type: 'O-', allergies: null, chronic_conditions: 'Congestive heart failure, Hypertension' },
  { first_name: 'Danladi', middle_name: null, last_name: 'Audu', dob: '1985-06-18', gender: 'Male', blood_type: 'B+', email: 'danladi.audu@example.com', allergies: null, chronic_conditions: 'HIV (on ART)' },
  { first_name: 'Zainab', middle_name: 'Aliyu', last_name: 'Shehu', dob: '2013-12-02', gender: 'Female', blood_type: 'O+', allergies: 'Penicillin', chronic_conditions: null },
];

/* ------------------------------------------------------------------ */
/* Visit scenarios (Tables 3.3.3.3 and 3.3.3.5)                         */
/* ------------------------------------------------------------------ */
type Sev = 'mild' | 'moderate' | 'severe';
interface Scenario {
  complaint: string;
  visit_type: 'walk_in' | 'emergency' | 'referral' | 'follow_up';
  symptoms: Array<[name: string, severity: Sev, duration: string, notes?: string]>;
  vitals: { temp?: [number, number]; bp?: string[]; hr?: [number, number]; spo2?: [number, number]; rr?: [number, number] };
  /** Diagnosis the doctor records if this visit is reviewed */
  diagnosis: string;
  /** If set, the doctor overrides the AI to this level with this reason */
  override?: { level: string; reason: string };
  outcome: 'in_progress' | 'treated' | 'discharged' | 'referred';
  /** Restrict which patients this fits (e.g. paediatric, pregnant, sickle cell) */
  fits?: (p: DemoPatient) => boolean;
}

const isChild = (p: DemoPatient) => new Date(p.dob) > daysAgo(365 * 16);
const isAdult = (p: DemoPatient) => !isChild(p);
const isSickle = (p: DemoPatient) => /sickle/i.test(p.chronic_conditions ?? '');
const isPregnant = (p: DemoPatient) => /pregnant/i.test(p.chronic_conditions ?? '');
const isElderly = (p: DemoPatient) => new Date(p.dob) < daysAgo(365 * 60);

const SCENARIOS: Scenario[] = [
  { complaint: 'High fever and headache for 3 days, shivering at night', visit_type: 'walk_in', symptoms: [['High Fever', 'moderate', '3–7 days', 'Intermittent, worse in the evenings'], ['Severe Headache', 'moderate', '3–7 days'], ['Generalised Weakness / Fatigue', 'mild', '3–7 days']], vitals: { temp: [38.4, 39.3], bp: ['118/76', '122/80', '110/72'], hr: [92, 108], spo2: [96, 99], rr: [16, 20] }, diagnosis: 'Uncomplicated Plasmodium falciparum malaria', outcome: 'treated' },
  { complaint: 'Fever, stiff neck and vomiting since this morning', visit_type: 'emergency', symptoms: [['High Fever', 'severe', 'Less than 24 hours'], ['Neck Stiffness (Nuchal Rigidity)', 'severe', 'Less than 24 hours', 'Cannot touch chin to chest'], ['Persistent Vomiting', 'moderate', 'Less than 24 hours'], ['Severe Headache', 'severe', 'Less than 24 hours', 'Photophobia present']], vitals: { temp: [39.4, 40.1], bp: ['104/66', '110/70'], hr: [112, 128], spo2: [94, 97], rr: [22, 26] }, diagnosis: 'Acute bacterial meningitis — started ceftriaxone', outcome: 'referred' },
  { complaint: 'Child has been vomiting and purging since yesterday, very weak', visit_type: 'walk_in', symptoms: [['Profuse Diarrhea', 'severe', '1–2 days', '8 watery stools today, no blood'], ['Persistent Vomiting', 'moderate', '1–2 days'], ['Signs of Dehydration', 'moderate', 'Less than 24 hours', 'Sunken eyes, drinks eagerly']], vitals: { temp: [37.6, 38.3], hr: [120, 150], spo2: [96, 99], rr: [24, 32] }, diagnosis: 'Acute gastroenteritis with some dehydration — ORS Plan B', outcome: 'treated', fits: isChild },
  { complaint: 'Crushing chest pain spreading to left arm, sweating', visit_type: 'emergency', symptoms: [['Chest Pain', 'severe', 'Less than 24 hours', 'Started 40 min ago while walking'], ['Shortness of Breath (Dyspnea)', 'moderate', 'Less than 24 hours'], ['Excessive Sweating / Night Sweats', 'moderate', 'Less than 24 hours']], vitals: { temp: [36.6, 37.2], bp: ['150/95', '162/100', '138/88'], hr: [98, 118], spo2: [93, 96], rr: [20, 24] }, diagnosis: 'Suspected acute coronary syndrome — aspirin given, referred for ECG/troponin', outcome: 'referred', fits: (p) => isAdult(p) && !isPregnant(p) },
  { complaint: 'Cough for two weeks, now coughing up blood and losing weight', visit_type: 'walk_in', symptoms: [['Persistent Cough', 'moderate', 'More than 2 weeks', 'Productive, worse at night'], ['Coughing up Blood', 'mild', '3–7 days', 'Streaks in sputum'], ['Excessive Sweating / Night Sweats', 'moderate', '1–2 weeks'], ['Loss of Appetite', 'mild', '1–2 weeks']], vitals: { temp: [37.4, 38.2], bp: ['112/70', '118/74'], hr: [84, 100], spo2: [94, 97], rr: [18, 22] }, diagnosis: 'Presumptive pulmonary TB — sputum GeneXpert requested', override: { level: 'urgent', reason: 'Haemoptysis with constitutional symptoms; needs same-day sputum and isolation, not routine.' }, outcome: 'in_progress', fits: isAdult },
  { complaint: 'Difficulty breathing and wheezing, inhaler not helping', visit_type: 'emergency', symptoms: [['Shortness of Breath (Dyspnea)', 'severe', 'Less than 24 hours', 'Cannot complete sentences'], ['Wheezing', 'severe', 'Less than 24 hours'], ['Persistent Cough', 'mild', '1–2 days']], vitals: { temp: [36.8, 37.4], bp: ['124/80', '130/84'], hr: [110, 126], spo2: [88, 92], rr: [28, 34] }, diagnosis: 'Acute severe asthma exacerbation — nebulised salbutamol, steroids', outcome: 'in_progress', fits: (p) => /asthma/i.test(p.chronic_conditions ?? '') },
  { complaint: 'Severe pain in both legs and back, known sickle cell', visit_type: 'walk_in', symptoms: [['Bone Pain (Sickle Cell Crisis)', 'severe', '1–2 days', 'Pain score 9/10, not relieved by paracetamol'], ['Generalised Weakness / Fatigue', 'moderate', '1–2 days'], ['Yellow Eyes / Skin (Jaundice)', 'mild', '3–7 days']], vitals: { temp: [37.2, 38.1], bp: ['108/68', '114/72'], hr: [100, 118], spo2: [93, 97], rr: [20, 24] }, diagnosis: 'Vaso-occlusive sickle cell crisis — IV fluids and analgesia', override: { level: 'emergent', reason: 'Known HbSS with severe pain and borderline SpO2 — must rule out acute chest syndrome quickly.' }, outcome: 'in_progress', fits: isSickle },
  { complaint: 'Fever for a week, stomach pain, not eating, now has diarrhoea', visit_type: 'walk_in', symptoms: [['High Fever', 'moderate', '1–2 weeks', 'Step-ladder pattern'], ['Severe Abdominal Pain', 'moderate', '3–7 days', 'Diffuse, tender lower abdomen'], ['Loss of Appetite', 'moderate', '1–2 weeks'], ['Profuse Diarrhea', 'mild', '1–2 days']], vitals: { temp: [38.6, 39.4], bp: ['104/66', '110/70'], hr: [76, 96], spo2: [96, 99], rr: [16, 20] }, diagnosis: 'Typhoid fever — Widal reactive, started ciprofloxacin', outcome: 'treated', fits: isAdult },
  { complaint: 'Bleeding since last night, 28 weeks pregnant', visit_type: 'emergency', symptoms: [['Vaginal Bleeding in Pregnancy', 'moderate', 'Less than 24 hours', 'Soaked two pads overnight'], ['Dizziness / Fainting', 'mild', 'Less than 24 hours'], ['Severe Abdominal Pain', 'mild', 'Less than 24 hours', 'Intermittent tightening']], vitals: { temp: [36.7, 37.1], bp: ['96/60', '100/64'], hr: [102, 116], spo2: [97, 99], rr: [18, 22] }, diagnosis: 'Antepartum haemorrhage — ?placenta praevia, referred to obstetric unit', override: { level: 'immediate', reason: 'APH at 28 weeks with tachycardia and borderline BP — immediate obstetric referral, not urgent.' }, outcome: 'referred', fits: isPregnant },
  { complaint: 'Sore throat and mild fever for two days', visit_type: 'walk_in', symptoms: [['Sore Throat', 'moderate', '1–2 days', 'Painful swallowing, no white patches'], ['High Fever', 'mild', '1–2 days']], vitals: { temp: [37.6, 38.3], bp: ['116/74', '120/78'], hr: [72, 88], spo2: [97, 99], rr: [14, 18] }, diagnosis: 'Viral pharyngitis — symptomatic treatment', outcome: 'discharged' },
  { complaint: 'Burning when passing urine, going frequently', visit_type: 'walk_in', symptoms: [['Painful Urination', 'moderate', '3–7 days'], ['High Fever', 'mild', '1–2 days']], vitals: { temp: [37.3, 38.0], bp: ['118/76', '124/80'], hr: [70, 86], spo2: [97, 99], rr: [14, 18] }, diagnosis: 'Uncomplicated urinary tract infection — nitrofurantoin', outcome: 'discharged', fits: isAdult },
  { complaint: 'Fell from motorcycle, pain in right leg, small cut on forehead', visit_type: 'emergency', symptoms: [['Injury / Trauma', 'moderate', 'Less than 24 hours', 'RTA 1 hour ago, no loss of consciousness'], ['Wound / Abscess', 'mild', 'Less than 24 hours', '3 cm laceration, bleeding controlled']], vitals: { temp: [36.5, 37.0], bp: ['126/82', '134/86'], hr: [88, 104], spo2: [97, 99], rr: [16, 20] }, diagnosis: 'Closed fracture right tibia (X-ray) + scalp laceration — sutured, tetanus toxoid given', override: { level: 'urgent', reason: 'Suspected long-bone fracture; needs analgesia, X-ray and splinting within 30 minutes.' }, outcome: 'referred', fits: isAdult },
  { complaint: 'Child with fever and body rash for 3 days, red eyes', visit_type: 'walk_in', symptoms: [['High Fever', 'moderate', '3–7 days'], ['Skin Rash', 'moderate', '1–2 days', 'Started behind ears, spreading down; blanches on pressure'], ['Persistent Cough', 'mild', '3–7 days']], vitals: { temp: [38.5, 39.5], hr: [110, 138], spo2: [95, 98], rr: [24, 30] }, diagnosis: 'Measles — vitamin A given, isolated, notified', outcome: 'treated', fits: isChild },
  { complaint: 'Swollen legs and breathless when lying down', visit_type: 'follow_up', symptoms: [['Swollen Legs / Ankles', 'moderate', '1–2 weeks', 'Pitting to mid-shin, both legs'], ['Shortness of Breath (Dyspnea)', 'moderate', '1–2 weeks', 'Needs 3 pillows to sleep'], ['Generalised Weakness / Fatigue', 'moderate', '1–2 weeks']], vitals: { temp: [36.5, 37.1], bp: ['146/92', '152/96'], hr: [88, 104], spo2: [92, 95], rr: [20, 24] }, diagnosis: 'Decompensated heart failure — furosemide adjusted', outcome: 'in_progress', fits: isElderly },
  { complaint: 'Sudden weakness of the left arm and face, slurred speech', visit_type: 'emergency', symptoms: [['Weakness on One Side of Body', 'severe', 'Less than 24 hours', 'Onset 2 hours ago, left arm and face'], ['Severe Headache', 'mild', 'Less than 24 hours'], ['Dizziness / Fainting', 'mild', 'Less than 24 hours']], vitals: { temp: [36.6, 37.2], bp: ['178/104', '186/108'], hr: [80, 96], spo2: [95, 98], rr: [16, 20] }, diagnosis: 'Acute stroke (likely ischaemic) — referred for CT within window', override: { level: 'immediate', reason: 'FAST-positive stroke within the thrombolysis window; hemiparesis was not weighted by the model.' }, outcome: 'referred', fits: (p) => isAdult(p) && /hypertension/i.test(p.chronic_conditions ?? '') },
  { complaint: 'Convulsed twice at home this morning with high fever', visit_type: 'emergency', symptoms: [['Seizures / Convulsions', 'severe', 'Less than 24 hours', 'Two generalised fits, each ~2 min'], ['High Fever', 'severe', '1–2 days'], ['Altered Consciousness / Confusion', 'moderate', 'Less than 24 hours', 'Drowsy but responds to voice']], vitals: { temp: [39.6, 40.3], hr: [130, 160], spo2: [93, 97], rr: [28, 36] }, diagnosis: 'Cerebral malaria — IV artesunate started', outcome: 'in_progress', fits: isChild },
  { complaint: 'Routine follow-up for blood pressure, feeling fine', visit_type: 'follow_up', symptoms: [], vitals: { temp: [36.4, 36.9], bp: ['128/82', '134/86', '122/78'], hr: [66, 80], spo2: [97, 99], rr: [12, 16] }, diagnosis: 'Hypertension — controlled, continue amlodipine', outcome: 'discharged', fits: (p) => /hypertension/i.test(p.chronic_conditions ?? '') },
  { complaint: 'Ear pain and discharge for 4 days', visit_type: 'walk_in', symptoms: [['Ear Pain / Discharge', 'moderate', '3–7 days', 'Right ear, yellow discharge'], ['High Fever', 'mild', '1–2 days']], vitals: { temp: [37.4, 38.1], hr: [80, 110], spo2: [97, 99], rr: [16, 24] }, diagnosis: 'Acute suppurative otitis media — amoxicillin', outcome: 'discharged' },
  { complaint: 'Palpitations and dizziness on and off for a week', visit_type: 'walk_in', symptoms: [['Palpitations', 'moderate', '1–2 weeks', 'Irregular, lasts minutes'], ['Dizziness / Fainting', 'mild', '1–2 weeks'], ['Generalised Weakness / Fatigue', 'mild', '1–2 weeks']], vitals: { temp: [36.5, 37.0], bp: ['112/70', '118/76'], hr: [104, 124], spo2: [96, 99], rr: [16, 20] }, diagnosis: 'Palpitations ?arrhythmia vs anaemia — ECG and FBC requested', outcome: 'in_progress', fits: isAdult },
  { complaint: 'Black stools and stomach pain, has ulcer', visit_type: 'walk_in', symptoms: [['Blood in Stool', 'moderate', '1–2 days', 'Black, tarry stools x3'], ['Severe Abdominal Pain', 'moderate', '3–7 days', 'Epigastric, worse when hungry'], ['Dizziness / Fainting', 'mild', 'Less than 24 hours']], vitals: { temp: [36.6, 37.1], bp: ['100/64', '106/68'], hr: [96, 112], spo2: [96, 99], rr: [16, 20] }, diagnosis: 'Upper GI bleed from peptic ulcer — IV PPI, referred for endoscopy', override: { level: 'emergent', reason: 'Melaena with tachycardia and soft BP suggests significant bleed.' }, outcome: 'referred', fits: (p) => /ulcer/i.test(p.chronic_conditions ?? '') },
  { complaint: 'Boil on the thigh getting bigger and painful', visit_type: 'walk_in', symptoms: [['Wound / Abscess', 'moderate', '3–7 days', '4 cm fluctuant swelling, left thigh']], vitals: { temp: [37.0, 37.8], bp: ['118/76', '124/80'], hr: [72, 90], spo2: [97, 99], rr: [14, 18] }, diagnosis: 'Thigh abscess — incised and drained', outcome: 'treated' },
];

/* ------------------------------------------------------------------ */
/* Seeding                                                              */
/* ------------------------------------------------------------------ */
async function seedWorkers() {
  const password_hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const ids: number[] = [];
  for (const w of WORKERS) {
    const row = await prisma.healthcareWorker.upsert({
      where: { employee_id: w.employee_id },
      update: { ...w, password_hash },
      create: { ...w, password_hash },
    });
    ids.push(row.user_id);
  }
  console.log(`✓ ${WORKERS.length} healthcare workers (password: "${SEED_PASSWORD}")`);
  return ids;
}

async function seedSymptoms() {
  for (const s of SYMPTOMS) {
    await prisma.symptom.upsert({ where: { symptom_name: s.symptom_name }, update: s, create: s });
  }
  const all = await prisma.symptom.findMany();
  console.log(`✓ ${all.length} symptoms in catalogue`);
  return new Map(all.map((s) => [s.symptom_name, s]));
}

async function resetClinicalData() {
  await prisma.recordSymptom.deleteMany();
  await prisma.patientRecord.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.session.deleteMany();
  await rm(path.join(UPLOAD_ROOT, 'patients'), { recursive: true, force: true });
  // Reset SQLite autoincrement so demo IDs are stable (#1, #2, …)
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name IN ('patients','patient_records','record_symptoms','sessions')`);
  } catch {
    /* not SQLite */
  }
  console.log('✓ Cleared patients, visits, sessions and photos');
}

async function seedPatients() {
  const created = [];
  await mkdir(path.join(UPLOAD_ROOT, 'patients'), { recursive: true });
  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const row = await prisma.patient.create({
      data: {
        first_name: p.first_name,
        middle_name: p.middle_name ?? null,
        last_name: p.last_name,
        date_of_birth: new Date(p.dob),
        gender: p.gender,
        email: p.email ?? null,
        blood_type: p.blood_type,
        allergies: p.allergies ?? null,
        chronic_conditions: p.chronic_conditions ?? null,
        created_at: daysAgo(40 - i, 8 + (i % 8), (i * 7) % 60),
      },
    });
    // Every other patient gets a placeholder photo; the rest show initials, so both states are visible in the demo
    if (i % 3 !== 2) {
      const photo_path = path.posix.join('patients', `${row.patient_id}-demo.png`);
      await writeFile(path.join(UPLOAD_ROOT, photo_path), makeDemoPortrait(row.patient_id, i));
      await prisma.patient.update({ where: { patient_id: row.patient_id }, data: { photo_path } });
    }
    created.push({ row, demo: p });
  }
  console.log(`✓ ${created.length} patients (${created.filter((_, i) => i % 3 !== 2).length} with photos)`);
  return created;
}

async function seedVisits(
  patients: Array<{ row: { patient_id: number; date_of_birth: Date; gender: string }; demo: DemoPatient }>,
  workerIds: number[],
  catalogue: Map<string, { symptom_id: number }>,
) {
  const doctors = WORKERS.map((w, i) => ({ ...w, id: workerIds[i] })).filter((w) => w.position === 'doctor');
  const nurses = WORKERS.map((w, i) => ({ ...w, id: workerIds[i] })).filter((w) => w.position === 'nurse');

  // Plan ~45 visits: each patient 1–4 visits, spread over the last 30 days; the newest few stay unreviewed.
  const plan: Array<{ patient: (typeof patients)[number]; scenario: Scenario; day: number }> = [];
  for (const patient of patients) {
    const fitting = SCENARIOS.filter((s) => !s.fits || s.fits(patient.demo));
    const n = 1 + Math.floor(rand() * 3) + (rand() < 0.25 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      plan.push({ patient, scenario: pick(fitting), day: Math.floor(between(0, 30)) });
    }
  }
  plan.sort((a, b) => b.day - a.day); // oldest first

  // The 6 most recent visits (today/yesterday) are left pending so the review queue has work in it
  const pendingCount = 6;
  for (let i = plan.length - pendingCount; i < plan.length; i++) plan[i].day = i >= plan.length - 3 ? 0 : 1;

  let count = 0;
  let reviewed = 0;
  let overridden = 0;
  const lastVisitByPatient = new Map<number, number>();

  for (let i = 0; i < plan.length; i++) {
    const { patient, scenario, day } = plan[i];
    const nurse = pick(nurses);
    const doctor = pick(doctors);
    const isPending = i >= plan.length - pendingCount;
    const hour = isPending && day === 0 ? Math.max(6, new Date().getHours() - Math.floor(between(0, 3))) : Math.floor(between(7, 20));
    const visitDate = daysAgo(day, hour, Math.floor(between(0, 59)));

    const v = scenario.vitals;
    const vitals = {
      temperature: v.temp ? round(between(...v.temp), 1) : null,
      bloodPressure: v.bp ? pick(v.bp) : null,
      heartRate: v.hr ? Math.round(between(...v.hr)) : null,
      oxygenLevel: v.spo2 ? Math.round(between(...v.spo2)) : null,
      respiratoryRate: v.rr ? Math.round(between(...v.rr)) : null,
    };
    const symptoms = scenario.symptoms.map(([name, severity, duration, notes]) => {
      const s = catalogue.get(name);
      if (!s) throw new Error(`Scenario references unknown symptom "${name}"`);
      return { symptom_id: s.symptom_id, name, severity, duration, notes: notes ?? null };
    });

    // Run the real engine so AI fields are consistent with the inputs
    const ai = evaluateTriage({
      age: Math.floor((visitDate.getTime() - patient.row.date_of_birth.getTime()) / 31557600000),
      gender: patient.row.gender,
      chiefComplaint: scenario.complaint,
      symptoms: symptoms.map((s) => ({ name: s.name, severity: s.severity, duration: s.duration })),
      vitals,
    });

    const willOverride = !isPending && !!scenario.override && scenario.override.level !== ai.triageLevel;
    const finalLevel = willOverride ? scenario.override!.level : ai.triageLevel;

    const record = await prisma.patientRecord.create({
      data: {
        patient_id: patient.row.patient_id,
        recorded_by: nurse.id,
        visit_type: scenario.visit_type,
        chief_complaint: scenario.complaint,
        vitals_temperature: vitals.temperature,
        vitals_blood_pressure: vitals.bloodPressure,
        vitals_heart_rate: vitals.heartRate,
        vitals_oxygen_level: vitals.oxygenLevel,
        vitals_respiratory_rate: vitals.respiratoryRate,
        ai_urgency_score: ai.urgencyScore,
        ai_triage_level: ai.triageLevel,
        ai_confidence: round(between(0.62, 0.97), 2),
        ai_reasoning: ai.reasoning,
        ai_suggested_tests: JSON.stringify(ai.suggestedTests),
        ai_differential_diagnosis: JSON.stringify(ai.differentialDiagnosis),
        assigned_to: isPending ? null : doctor.id,
        override_status: isPending ? 'pending' : willOverride ? 'overridden' : 'accepted',
        override_reason: willOverride ? scenario.override!.reason : null,
        final_triage_level: finalLevel,
        diagnosis: isPending ? null : scenario.diagnosis,
        treated_by: isPending ? null : doctor.id,
        status: isPending ? 'triaged' : scenario.outcome,
        is_current: false,
        visit_date: visitDate,
        record_symptoms: {
          create: symptoms.map((s) => ({ symptom_id: s.symptom_id, severity: s.severity, duration: s.duration, notes: s.notes })),
        },
      },
    });

    lastVisitByPatient.set(patient.row.patient_id, record.record_id);
    count++;
    if (!isPending) reviewed++;
    if (willOverride) overridden++;
  }

  // Exactly one current assessment per patient: their latest visit
  for (const recordId of lastVisitByPatient.values()) {
    await prisma.patientRecord.update({ where: { record_id: recordId }, data: { is_current: true } });
  }

  console.log(`✓ ${count} visits (${reviewed} reviewed, ${overridden} overridden, ${count - reviewed} awaiting review)`);
}

async function main() {
  console.log(`Seeding MedTriage AI demo database${RESET ? ' (RESET)' : ''}…`);
  const workerIds = await seedWorkers();
  const catalogue = await seedSymptoms();

  if (RESET) await resetClinicalData();

  const existingPatients = await prisma.patient.count();
  if (existingPatients > 0 && !RESET) {
    console.log(`• ${existingPatients} patients already present — skipping demo patients/visits (run "npm run seed:demo" to rebuild)`);
    return;
  }

  const patients = await seedPatients();
  await seedVisits(patients, workerIds, catalogue);
  console.log('Done. Sign in with HW-DOC-001 (doctor) or HW-NUR-002 (nurse).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
