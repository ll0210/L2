export type LearningRecord = Record<string, any>;

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
  login(email: string, password: string): Promise<any>;
  register(input: { username?: string; email?: string; password?: string }): Promise<any>;
  me(user: LearningRecord): any;
  userSkills(user: LearningRecord): any;
  listChallenges(user?: LearningRecord): any[];
  challengeDetail(slug: string, user?: LearningRecord): any;
  workspace(slug: string, user: LearningRecord): any;
  submit(slug: string, user: LearningRecord, flag: string): any;
  unlockHint(slug: string, hintId: string, user: LearningRecord): any;
  startLab(user: LearningRecord, challengeId: string): any;
  labStatus(slug: string, user: LearningRecord): any;
  refreshLab(slug: string, user: LearningRecord): any;
  stopLab(slug: string, user: LearningRecord): any;
  rangeOverview(user?: LearningRecord): any;
  dashboardStats(user?: LearningRecord): any;
  dashboardEvents(): any[];
  leaderboard(): any[];
  skillGraph(): any;
  learningOverview(user?: LearningRecord): any;
  attackScenario(): any;
  aiChat(user: LearningRecord, message: string, challengeId?: string, hintLevel?: number): any;
  catalogSources(): any[];
}

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

