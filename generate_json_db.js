const fs = require('fs');
// This script will generate the src/lib/jsonDb.ts file
const code = `
import fs from 'fs';
import path from 'path';

// Define paths to data
const dataDir = path.join(process.cwd(), 'data');

// Load data into memory
let workers = JSON.parse(fs.readFileSync(path.join(dataDir, 'workers.json'), 'utf-8'));
let patients = JSON.parse(fs.readFileSync(path.join(dataDir, 'patients.json'), 'utf-8'));
let records = JSON.parse(fs.readFileSync(path.join(dataDir, 'records.json'), 'utf-8'));
let symptoms = JSON.parse(fs.readFileSync(path.join(dataDir, 'symptoms.json'), 'utf-8'));
let recordSymptoms = JSON.parse(fs.readFileSync(path.join(dataDir, 'recordSymptoms.json'), 'utf-8'));
let sessions: any[] = []; // Sessions are purely in-memory for this mock

function matchWhere(item: any, where: any) {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    const condition = where[key];
    if (condition && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date)) {
      if (condition.in) {
        if (!condition.in.includes(item[key])) return false;
      } else if (condition.gte !== undefined || condition.lte !== undefined) {
        if (condition.gte !== undefined && item[key] < condition.gte) return false;
        if (condition.lte !== undefined && item[key] > condition.lte) return false;
      }
    } else {
      if (item[key] !== condition) return false;
    }
  }
  return true;
}

function processInclude(item: any, include: any, modelName: string) {
  if (!include) return item;
  const res = { ...item };
  if (modelName === 'patient' && include.records) {
    res.records = records.filter((r: any) => r.patient_id === item.patient_id);
    if (include.records.include && include.records.include.record_symptoms) {
      res.records = res.records.map((r: any) => ({
        ...r,
        record_symptoms: recordSymptoms.filter((rs: any) => rs.record_id === r.record_id)
      }));
    }
  }
  if (modelName === 'patientRecord') {
    if (include.patient) res.patient = patients.find((p: any) => p.patient_id === item.patient_id);
    if (include.recorder) res.recorder = workers.find((w: any) => w.user_id === item.recorded_by);
    if (include.record_symptoms) {
      let rs = recordSymptoms.filter((rs: any) => rs.record_id === item.record_id);
      if (include.record_symptoms.include && include.record_symptoms.include.symptom) {
        rs = rs.map((rsItem: any) => ({
          ...rsItem,
          symptom: symptoms.find((s: any) => s.symptom_id === rsItem.symptom_id)
        }));
      }
      res.record_symptoms = rs;
    }
  }
  return res;
}

function createModel(dataArray: any[], idField: string, modelName: string) {
  return {
    findMany: async (args: any = {}) => {
      let res = dataArray.filter(item => matchWhere(item, args.where));
      if (args.orderBy) {
         const keys = Object.keys(args.orderBy);
         if (keys.length > 0) {
             const key = keys[0];
             const dir = args.orderBy[key];
             res.sort((a, b) => {
                 if (a[key] < b[key]) return dir === 'asc' ? -1 : 1;
                 if (a[key] > b[key]) return dir === 'asc' ? 1 : -1;
                 return 0;
             });
         }
      }
      if (args.take) res = res.slice(0, args.take);
      if (args.include) res = res.map(item => processInclude(item, args.include, modelName));
      return res;
    },
    findFirst: async (args: any = {}) => {
      let res = dataArray.filter(item => matchWhere(item, args.where));
      if (res.length === 0) return null;
      let item = res[0];
      if (args.include) item = processInclude(item, args.include, modelName);
      return item;
    },
    findUnique: async (args: any = {}) => {
      let res = dataArray.filter(item => matchWhere(item, args.where));
      if (res.length === 0) return null;
      let item = res[0];
      if (args.include) item = processInclude(item, args.include, modelName);
      if (args.select) {
        const selected: any = {};
        for (const k of Object.keys(args.select)) {
          if (args.select[k]) selected[k] = item[k];
        }
        return selected;
      }
      return item;
    },
    create: async (args: any) => {
      const newItem = { ...args.data };
      if (!newItem[idField]) {
        const maxId = dataArray.length > 0 ? Math.max(...dataArray.map(d => d[idField] || 0)) : 0;
        newItem[idField] = maxId + 1;
      }
      dataArray.push(newItem);
      return processInclude(newItem, args.include, modelName);
    },
    createMany: async (args: any) => {
      let count = 0;
      for (const d of args.data) {
        const newItem = { ...d };
        if (!newItem[idField]) {
          const maxId = dataArray.length > 0 ? Math.max(...dataArray.map(x => x[idField] || 0)) : 0;
          newItem[idField] = maxId + 1;
        }
        dataArray.push(newItem);
        count++;
      }
      return { count };
    },
    update: async (args: any) => {
      const idx = dataArray.findIndex(item => matchWhere(item, args.where));
      if (idx === -1) throw new Error("Not found");
      dataArray[idx] = { ...dataArray[idx], ...args.data };
      return processInclude(dataArray[idx], args.include, modelName);
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (matchWhere(dataArray[i], args.where)) {
          dataArray[i] = { ...dataArray[i], ...args.data };
          count++;
        }
      }
      return { count };
    },
    delete: async (args: any) => {
      const idx = dataArray.findIndex(item => matchWhere(item, args.where));
      if (idx === -1) throw new Error("Not found");
      const deleted = dataArray[idx];
      dataArray.splice(idx, 1);
      return deleted;
    },
    deleteMany: async (args: any) => {
      const originalLength = dataArray.length;
      const keep = dataArray.filter(item => !matchWhere(item, args.where));
      const deletedCount = originalLength - keep.length;
      dataArray.length = 0;
      dataArray.push(...keep);
      return { count: deletedCount };
    },
    count: async (args: any = {}) => {
      return dataArray.filter(item => matchWhere(item, args.where)).length;
    },
    groupBy: async (args: any) => {
      const res = dataArray.filter(item => matchWhere(item, args.where));
      const groups: any = {};
      const byField = args.by[0];
      for (const item of res) {
        const key = item[byField];
        if (!groups[key]) groups[key] = { [byField]: key, _count: { _all: 0 } };
        groups[key]._count._all++;
      }
      return Object.values(groups);
    }
  };
}

export const jsonDb = {
  healthcareWorker: createModel(workers, 'user_id', 'healthcareWorker'),
  patient: createModel(patients, 'patient_id', 'patient'),
  patientRecord: createModel(records, 'record_id', 'patientRecord'),
  symptom: createModel(symptoms, 'symptom_id', 'symptom'),
  recordSymptom: createModel(recordSymptoms, 'record_symptom_id', 'recordSymptom'),
  session: createModel(sessions, 'id', 'session'),
  $transaction: async (fn: any) => {
    // Just execute the function passing the jsonDb as tx
    return fn(jsonDb);
  }
};

export default jsonDb;
`;

fs.writeFileSync('src/lib/jsonDb.ts', code);
console.log('jsonDb created');
