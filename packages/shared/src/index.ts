export type Role = 'USER' | 'ADMIN';
export type ChallengeCategory = 'WEB' | 'CRYPTO' | 'NETWORK' | 'REVERSE' | 'PWN' | 'FORENSICS' | 'MISC';
export type ChallengeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type LabStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'EXPIRED' | 'FAILED';

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  score: number;
  xp: number;
  level: number;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface ChallengeSummary {
  id: string;
  slug: string;
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  points: number;
  description: string;
  solves: number;
  solved: boolean;
  available: boolean;
}

