export interface User {
  id: string;
  email: string;
  name?: string;
  dateOfBirth?: string;
  profileCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  name: string;
  dateOfBirth: string;
  disease?: string;
  diagnosis?: string;
  currentTreatments?: string;
  treatmentGoals?: string;
  initialSymptoms?: string;
}

