
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface BreedResult {
  id: string;
  userId: string;
  imageUrl: string;
  animalType: string;
  breedName: string;
  confidence: number;
  description: string;
  similarBreeds: string[];
  timestamp: string;
  healthAnalysis?: HealthAnalysisResponse;
  // New Fields
  price: number;
  uses: string[];
  lifeExpectancy: string;
  dietRoutine: string;
  exercisePlan: string;
  isPurchased?: boolean;
}

export interface PredictionResponse {
  animalType: string;
  breedName: string;
  confidence: number;
  description: string;
  similarBreeds: string[];
  price: number;
  uses: string[];
  lifeExpectancy: string;
  dietRoutine: string;
  exercisePlan: string;
}

export interface HealthIssue {
  issue: string;
  severity: 'Low' | 'Medium' | 'High';
  description: string;
  recommendedAction: string;
}

export interface HealthAnalysisResponse {
  potentialIssues: HealthIssue[];
  summary: string;
  isHealthy: boolean;
}
