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

export interface SubmissionAttempt {
  id: string;
  correct: boolean;
  createdAt: string;
}

export interface LabSession {
  instanceId?: string;
  status: LabStatus;
  running: boolean;
  requiresLogin?: boolean;
  accessMode?: 'LOCAL_GUIDED' | 'DOCKER';
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds: number;
}

export interface ChallengeHint {
  id: string;
  title: string;
  cost: number;
  order: number;
  unlocked: boolean;
  content?: string;
}

export interface WorkspaceOverview {
  session: LabSession;
  recentSubmissions: SubmissionAttempt[];
  submissionStats: { total: number; correct: number };
  resourceHealth: { status: 'READY' | 'DEGRADED' | 'UNAVAILABLE' };
  nextChallenge?: Pick<ChallengeSummary, 'slug' | 'title'>;
}

export interface ChallengeDetail extends ChallengeSummary {
  tags: string[];
  attachmentCount: number;
  hasConnection: boolean;
  hints: ChallengeHint[];
  attachments: Array<{ id: string; name: string; url?: string }>;
  connection?: { host?: string; port?: number };
  workspace: WorkspaceOverview;
  attempts: SubmissionAttempt[];
  submissionStats: { total: number; correct: number };
}

export interface SubmissionResult {
  success: boolean;
  alreadySolved?: boolean;
  message?: string;
  points?: number;
  newScore?: number;
  isFirstBlood?: boolean;
  skillRewards?: Array<{ skillSlug: string; xp: number; newLevel: number }>;
  attempts: SubmissionAttempt[];
}

export interface DashboardStats {
  activeUsers: number;
  registeredUsers: number;
  totalChallenges: number;
  totalSolves: number;
  runningLabs: number;
  onlineUsers: number;
  solvesToday: number;
}

export interface DashboardEvent {
  username: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  level: number;
  score: number;
  solved: number;
}

export interface RangeOverview {
  metrics: { availableTasks: number; activeSessions: number; completed: number; attachments: number };
  sessions: Array<LabSession & { slug?: string; title?: string; category?: ChallengeCategory; expiresInMinutes?: number }>;
  tasks: ChallengeSummary[];
}

export interface SkillNode {
  slug: string;
  name: string;
  category: string;
  description: string;
  x: number;
  y: number;
}

export interface SkillGraph {
  nodes: SkillNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface SkillProgress {
  skill: Omit<SkillNode, 'x' | 'y'>;
  xp: number;
  level: number;
  status: 'LOCKED' | 'AVAILABLE' | 'LEARNING' | 'MASTERED';
}

export interface CourseOverview {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  duration: string;
  category: string;
  chapters: string[];
  challengeSlug: string;
  progress: number;
  completed: boolean;
}

export interface LearningOverview {
  summary: { courseCount: number; finished: number; skillXp: number };
  courses: CourseOverview[];
}

export interface AttackScenario {
  description: string;
  phases: Array<{ id: string; time: string; title: string; mitre: string; detail: string }>;
  controls: Array<{ name: string; status: string; description: string }>;
}

export interface RealtimeReadyEvent {
  connectedAt: string;
}

export interface ChallengeSolvedEvent {
  challengeRef: string;
  points: number;
  isFirstBlood: boolean;
  occurredAt: string;
}

export interface LeaderboardUpdatedEvent {
  occurredAt: string;
}

export interface LabStatusEvent {
  challengeRef: string;
  session: LabSession;
  occurredAt: string;
}

export interface RealtimeEventMap {
  'session.ready': RealtimeReadyEvent;
  'challenge.solved': ChallengeSolvedEvent;
  'leaderboard.updated': LeaderboardUpdatedEvent;
  'lab.status': LabStatusEvent;
}
