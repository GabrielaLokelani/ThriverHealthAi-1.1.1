export interface HealthData {
  id: string;
  disease?: string;
  diagnosis?: string;
  currentTreatments?: string;
  treatmentGoals?: string;
  initialSymptoms?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HealthMetric {
  id: string;
  name: string;
  value?: string;
  unit?: string;
  date: string;
  notes?: string;
  createdAt?: string;
}

export interface HealthSummary {
  id: string;
  summary: string;
  generatedAt: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  createdAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GratitudeEntry {
  id: string;
  content: string;
  date: string;
  createdAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  completed: boolean;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

