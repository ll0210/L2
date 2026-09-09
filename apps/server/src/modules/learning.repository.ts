import type { AttackScenario, AuthResponse, AuthUser, ChallengeDetail, ChallengeSummary, DashboardEvent, DashboardStats, LabSession, LeaderboardEntry, LearningOverview, RangeOverview, SkillGraph, SkillProgress, SubmissionResult, WorkspaceOverview } from '@cyberquest/shared';

export type LearningRecord = Record<string, any>;
type RepositoryResult<T> = T | Promise<T>;

/**
 * Application boundary for platform state.
 *
 * The local JSON implementation is intentionally behind this port so that the
 * HTTP surface can be retained when Prisma/PostgreSQL replaces it.
 */
export interface LearningRepository {
  assertRateLimit(scope: string, identity: string, max: number, milliseconds: number): void;
  userFromAuthorization(header?: string): LearningRecord | undefined;
  requireUser(header?: string): LearningRecord;
  login(email: string, password: string): Promise<AuthResponse>;
  register(input: { username?: string; email?: string; password?: string }): Promise<AuthResponse>;
  me(user: LearningRecord): RepositoryResult<AuthUser>;
  userSkills(user: LearningRecord): RepositoryResult<SkillProgress[]>;
  listChallenges(user?: LearningRecord): RepositoryResult<ChallengeSummary[]>;
  challengeDetail(slug: string, user?: LearningRecord): RepositoryResult<ChallengeDetail>;
  workspace(slug: string, user: LearningRecord): RepositoryResult<WorkspaceOverview>;
  submit(slug: string, user: LearningRecord, flag: string): RepositoryResult<SubmissionResult>;
  unlockHint(slug: string, hintId: string, user: LearningRecord): RepositoryResult<{ content: string; cost: number; newScore: number }>;
  startLab(user: LearningRecord, challengeId: string): RepositoryResult<LabSession & { message?: string }>;
  labStatus(slug: string, user: LearningRecord): RepositoryResult<{ session: LabSession; resourceHealth: { status: 'READY' } }>;
  refreshLab(slug: string, user: LearningRecord): RepositoryResult<{ session: LabSession }>;
  stopLab(slug: string, user: LearningRecord): RepositoryResult<{ session: LabSession; message: string }>;
  rangeOverview(user?: LearningRecord): RepositoryResult<RangeOverview>;
  dashboardStats(user?: LearningRecord): RepositoryResult<DashboardStats>;
  dashboardEvents(): RepositoryResult<DashboardEvent[]>;
  leaderboard(): RepositoryResult<LeaderboardEntry[]>;
  skillGraph(): RepositoryResult<SkillGraph>;
  learningOverview(user?: LearningRecord): RepositoryResult<LearningOverview>;
  attackScenario(): AttackScenario;
  aiChat(user: LearningRecord, message: string, challengeId?: string, hintLevel?: number): RepositoryResult<{ content: string; provider: string }>;
  catalogSources(): unknown[];
}

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');
