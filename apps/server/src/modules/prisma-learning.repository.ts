import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { SkillStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac } from 'node:crypto';
import { LearningRecord, LearningRepository } from './learning.repository';
import { PrismaService } from './prisma.service';

const jwt = require('jsonwebtoken') as {
  sign: (payload: object, secret: string, options: { expiresIn: string }) => string;
  verify: (token: string, secret: string) => unknown;
};

const CATEGORY_TAGS: Record<string, string[]> = {
  WEB: ['HTTP', 'input validation', 'trust boundary'],
  CRYPTO: ['encoding', 'data representation', 'verifiable steps'],
  NETWORK: ['DNS', 'HTTP', 'traffic analysis'],
  REVERSE: ['strings', 'static analysis', 'program intent'],
  PWN: ['bounds checks', 'memory safety', 'secure coding'],
  FORENSICS: ['metadata', 'timeline', 'evidence'],
  MISC: ['research', 'evidence', 'specification'],
};

@Injectable()
export class PrismaLearningRepository implements LearningRepository, OnModuleInit, OnModuleDestroy {
  private readonly tokenSecret = process.env.JWT_ACCESS_SECRET || 'cyberquest-local-development-secret';
  private readonly rateWindows = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  private fail(status: number, code: string, message: string): never {
    const value = { code, message };
    if (status === 400) throw new BadRequestException(value);
    if (status === 401) throw new UnauthorizedException(value);
    if (status === 403) throw new ForbiddenException(value);
    if (status === 404) throw new NotFoundException(value);
    if (status === 409) throw new ConflictException(value);
    if (status === 429) throw new HttpException(value, HttpStatus.TOO_MANY_REQUESTS);
    throw new BadRequestException(value);
  }

  assertRateLimit(scope: string, identity: string, max: number, milliseconds: number) {
    const key = `${scope}:${identity}`;
    const now = Date.now();
    const entries = (this.rateWindows.get(key) ?? []).filter((time) => now - time < milliseconds);
    if (entries.length >= max) this.fail(429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
    entries.push(now);
    this.rateWindows.set(key, entries);
  }

  userFromAuthorization(header?: string): LearningRecord | undefined {
    if (!header?.startsWith('Bearer ')) return undefined;
    try {
      const payload = jwt.verify(header.slice(7), this.tokenSecret) as { sub?: string; email?: string; role?: string };
      if (!payload.sub) this.fail(401, 'AUTH_TOKEN_INVALID', 'Access token is invalid.');
      return { id: payload.sub, email: payload.email, role: payload.role };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.fail(401, 'AUTH_TOKEN_EXPIRED', 'Access token is invalid or expired.');
    }
  }

  requireUser(header?: string): LearningRecord {
    const user = this.userFromAuthorization(header);
    if (!user) this.fail(401, 'AUTH_FORBIDDEN', 'Please sign in before continuing.');
    return user;
  }

  private publicUser(user: any) {
    return { id: user.id, username: user.username, email: user.email, role: user.role, score: user.score, xp: user.xp, level: user.level };
  }

  private signUser(user: any) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.tokenSecret, { expiresIn: '15m' });
  }

  private attemptHash(value: string) {
    return createHmac('sha256', process.env.ATTEMPT_HASH_SECRET || this.tokenSecret).update(value, 'utf8').digest('hex');
  }

  private async databaseUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) this.fail(401, 'AUTH_FORBIDDEN', 'Your account is no longer available.');
    return user;
  }

  private async challengeBySlug(slug: string, include?: any): Promise<any> {
    const challenge = await this.prisma.challenge.findFirst({
      where: { isActive: true, OR: [{ slug }, { id: slug }] },
      include,
    });
    if (!challenge) this.fail(404, 'CHALLENGE_NOT_FOUND', 'Challenge not found or not published.');
    return challenge;
  }

  private async solvedIds(user?: LearningRecord) {
    if (!user) return new Set<string>();
    const solves = await this.prisma.challengeSolve.findMany({ where: { userId: user.id }, select: { challengeId: true } });
    return new Set(solves.map((item) => item.challengeId));
  }

  private challengeSummary(challenge: any, solved: Set<string>) {
    return {
      id: challenge.id,
      slug: challenge.slug,
      title: challenge.title,
      category: challenge.category,
      difficulty: challenge.difficulty,
      points: challenge.points,
      description: challenge.description,
      tags: CATEGORY_TAGS[challenge.category] ?? ['security training'],
      solves: challenge._count?.solves ?? 0,
      solved: solved.has(challenge.id),
      available: true,
      attachmentCount: 0,
      hasConnection: false,
    };
  }

  private async recentAttempts(userId: string, challengeId: string) {
    const attempts = await this.prisma.challengeAttempt.findMany({
      where: { userId, challengeId }, orderBy: { createdAt: 'desc' }, take: 5,
    });
    return attempts.map((attempt) => ({ id: attempt.id, correct: attempt.correct, createdAt: attempt.createdAt.toISOString() }));
  }

  private async sessionFor(userId: string | undefined, challengeId: string) {
    if (!userId) return { status: 'STOPPED', running: false, requiresLogin: true, remainingSeconds: 0 };
    await this.prisma.labInstance.updateMany({
      where: { userId, status: 'RUNNING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED', stoppedAt: new Date() },
    });
    const lab = await this.prisma.labInstance.findFirst({
      where: { userId, challengeId, status: 'RUNNING' }, orderBy: { startedAt: 'desc' },
    });
    if (!lab) return { status: 'STOPPED', running: false, requiresLogin: false, remainingSeconds: 0 };
    const remainingSeconds = Math.max(0, Math.ceil((lab.expiresAt.getTime() - Date.now()) / 1000));
    return {
      instanceId: lab.id,
      status: lab.status,
      accessMode: 'LOCAL_GUIDED',
      startedAt: lab.startedAt?.toISOString(),
      expiresAt: lab.expiresAt.toISOString(),
      remainingSeconds,
      running: remainingSeconds > 0,
    };
  }

  private async workspaceFor(challengeId: string, userId: string) {
    const [session, attempts, next] = await Promise.all([
      this.sessionFor(userId, challengeId),
      this.recentAttempts(userId, challengeId),
      this.prisma.challenge.findFirst({ where: { isActive: true, id: { not: challengeId }, solves: { none: { userId } } }, orderBy: [{ category: 'asc' }, { points: 'asc' }] }),
    ]);
    const submissionStats = { total: attempts.length, correct: attempts.filter((item) => item.correct).length };
    return {
      session,
      recentSubmissions: attempts,
      submissionStats,
      resourceHealth: { status: 'READY' },
      nextChallenge: next ? { slug: next.slug, title: next.title } : undefined,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) this.fail(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } }),
      this.prisma.activity.create({ data: { userId: user.id, type: 'LOGIN', metadata: { message: 'Signed in to CyberQuest.' } } }),
    ]);
    return { user: this.publicUser(user), accessToken: this.signUser(user) };
  }

  async register(input: { username?: string; email?: string; password?: string }) {
    const username = input.username?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!username || username.length < 2 || !email || !/^\S+@\S+\.\S+$/.test(email) || !input.password || input.password.length < 8) {
      this.fail(400, 'VALIDATION_FAILED', 'Provide a display name, valid email address, and password of at least 8 characters.');
    }
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) this.fail(409, 'AUTH_ACCOUNT_EXISTS', 'Email address or display name is already in use.');
    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({ data: { username, email, passwordHash, lastActiveAt: new Date() } });
    await this.prisma.activity.create({ data: { userId: user.id, type: 'REGISTER', metadata: { message: 'Created a learning profile.' } } });
    return { user: this.publicUser(user), accessToken: this.signUser(user) };
  }

  async me(user: LearningRecord) {
    return this.publicUser(await this.databaseUser(user.id));
  }

  async listChallenges(user?: LearningRecord) {
    const [challenges, solved] = await Promise.all([
      this.prisma.challenge.findMany({ where: { isActive: true }, include: { _count: { select: { solves: true } } }, orderBy: [{ category: 'asc' }, { points: 'asc' }] }),
      this.solvedIds(user),
    ]);
    return challenges.map((challenge) => this.challengeSummary(challenge, solved));
  }

  async challengeDetail(slug: string, user?: LearningRecord) {
    const [challenge, solved] = await Promise.all([
      this.challengeBySlug(slug, { _count: { select: { solves: true } }, hints: { orderBy: { order: 'asc' } } }),
      this.solvedIds(user),
    ]);
    const [unlocks, workspace] = user
      ? await Promise.all([
        this.prisma.userHint.findMany({ where: { userId: user.id, hint: { challengeId: challenge.id } }, select: { hintId: true } }),
        this.workspaceFor(challenge.id, user.id),
      ])
      : [[], undefined];
    const unlocked = new Set(unlocks.map((item) => item.hintId));
    const hints = challenge.hints.map((hint: any) => ({ id: hint.id, title: hint.title, cost: hint.cost, order: hint.order, unlocked: hint.cost === 0 || unlocked.has(hint.id), ...((hint.cost === 0 || unlocked.has(hint.id)) ? { content: hint.content } : {}) }));
    const attempts = user ? await this.recentAttempts(user.id, challenge.id) : [];
    const submissionStats = { total: attempts.length, correct: attempts.filter((item) => item.correct).length };
    return {
      ...this.challengeSummary(challenge, solved),
      hints,
      attachments: [],
      connection: undefined,
      workspace: workspace ?? { session: await this.sessionFor(undefined, challenge.id), recentSubmissions: [], submissionStats, resourceHealth: { status: 'READY' } },
      attempts,
      submissionStats,
    };
  }

  async workspace(slug: string, user: LearningRecord) {
    const challenge = await this.challengeBySlug(slug);
    await this.databaseUser(user.id);
    return this.workspaceFor(challenge.id, user.id);
  }

  async submit(slug: string, user: LearningRecord, flag: string) {
    if (!flag?.trim()) this.fail(400, 'VALIDATION_FAILED', 'Enter a flag before submitting.');
    const [challenge, databaseUser] = await Promise.all([
      this.challengeBySlug(slug, { skills: { include: { skill: true } } }),
      this.databaseUser(user.id),
    ]);
    let correct = false;
    try { correct = await argon2.verify(challenge.flagHash, flag.trim()); } catch { correct = false; }
    await this.prisma.challengeAttempt.create({ data: { userId: databaseUser.id, challengeId: challenge.id, submittedHash: this.attemptHash(flag.trim()), correct } });
    if (!correct) {
      await this.prisma.activity.create({ data: { userId: databaseUser.id, type: 'FLAG_ATTEMPT', metadata: { challengeId: challenge.id, message: `Attempted ${challenge.title}.` } } });
      return { success: false, message: 'Flag incorrect', attempts: await this.recentAttempts(databaseUser.id, challenge.id) };
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.challengeSolve.findUnique({ where: { userId_challengeId: { userId: databaseUser.id, challengeId: challenge.id } } });
      if (existing) return { alreadySolved: true, user: await tx.user.findUniqueOrThrow({ where: { id: databaseUser.id } }) };
      const beforeSolveCount = await tx.challengeSolve.count({ where: { challengeId: challenge.id } });
      await tx.challengeSolve.create({ data: { userId: databaseUser.id, challengeId: challenge.id, points: challenge.points, isFirstBlood: beforeSolveCount === 0 } });
      const updatedUser = await tx.user.update({
        where: { id: databaseUser.id },
        data: { score: { increment: challenge.points }, xp: { increment: challenge.points }, level: Math.max(1, Math.floor((databaseUser.xp + challenge.points) / 250) + 1), lastActiveAt: new Date() },
      });
      const skillRewards: Array<{ skillSlug: string; xp: number; newLevel: number }> = [];
      for (const relation of challenge.skills) {
        const existingSkill = await tx.userSkill.findUnique({ where: { userId_skillId: { userId: databaseUser.id, skillId: relation.skillId } } });
        const xp = (existingSkill?.xp ?? 0) + relation.xpReward;
        const level = Math.max(1, Math.floor(xp / 100) + 1);
        await tx.userSkill.upsert({
          where: { userId_skillId: { userId: databaseUser.id, skillId: relation.skillId } },
          update: { xp, level, status: SkillStatus.LEARNING },
          create: { userId: databaseUser.id, skillId: relation.skillId, xp, level, status: SkillStatus.LEARNING },
        });
        skillRewards.push({ skillSlug: relation.skill.slug, xp: relation.xpReward, newLevel: level });
      }
      await tx.activity.create({ data: { userId: databaseUser.id, type: 'CHALLENGE_SOLVE', metadata: { challengeId: challenge.id, message: `Solved ${challenge.title}.` } } });
      return { alreadySolved: false, user: updatedUser, isFirstBlood: beforeSolveCount === 0, skillRewards };
    });
    const attempts = await this.recentAttempts(databaseUser.id, challenge.id);
    if (result.alreadySolved) return { success: true, alreadySolved: true, message: 'Challenge already completed; score was not added twice.', newScore: result.user.score, attempts };
    return { success: true, points: challenge.points, newScore: result.user.score, isFirstBlood: result.isFirstBlood, skillRewards: result.skillRewards, attempts };
  }

  async unlockHint(slug: string, hintId: string, user: LearningRecord) {
    const challenge = await this.challengeBySlug(slug, { hints: true });
    const hint = challenge.hints.find((item: any) => item.id === hintId);
    if (!hint) this.fail(404, 'HINT_NOT_FOUND', 'Hint not found.');
    if (hint.cost === 0) return { content: hint.content, cost: 0, newScore: (await this.databaseUser(user.id)).score };
    const result = await this.prisma.$transaction(async (tx) => {
      const [databaseUser, existing] = await Promise.all([
        tx.user.findUnique({ where: { id: user.id } }),
        tx.userHint.findUnique({ where: { userId_hintId: { userId: user.id, hintId: hint.id } } }),
      ]);
      if (!databaseUser) this.fail(401, 'AUTH_FORBIDDEN', 'Your account is no longer available.');
      if (existing) this.fail(409, 'HINT_ALREADY_UNLOCKED', 'Hint is already unlocked.');
      if (databaseUser.score < hint.cost) this.fail(400, 'INSUFFICIENT_POINTS', 'Not enough score to unlock this hint.');
      const updatedUser = await tx.user.update({ where: { id: databaseUser.id }, data: { score: { decrement: hint.cost }, lastActiveAt: new Date() } });
      await tx.userHint.create({ data: { userId: databaseUser.id, hintId: hint.id } });
      await tx.activity.create({ data: { userId: databaseUser.id, type: 'HINT_UNLOCK', metadata: { challengeId: challenge.id, hintId: hint.id, message: `Unlocked hint for ${challenge.title}.` } } });
      return updatedUser;
    });
    return { content: hint.content, cost: hint.cost, newScore: result.score };
  }

  async startLab(user: LearningRecord, challengeId: string) {
    const [challenge, databaseUser] = await Promise.all([this.challengeBySlug(challengeId), this.databaseUser(user.id)]);
    const existing = await this.sessionFor(databaseUser.id, challenge.id);
    if (existing.running) return { ...existing, message: 'A guided learning session is already running for this challenge.' };
    const ttl = Math.max(60, Number(process.env.LAB_TTL_SECONDS ?? 1800));
    const startedAt = new Date();
    const lab = await this.prisma.labInstance.create({ data: { userId: databaseUser.id, challengeId: challenge.id, status: 'RUNNING', startedAt, expiresAt: new Date(startedAt.getTime() + ttl * 1000) } });
    await this.prisma.activity.create({ data: { userId: databaseUser.id, type: 'LAB_START', metadata: { challengeId: challenge.id, message: `Started a guided session for ${challenge.title}.` } } });
    return { instanceId: lab.id, status: lab.status, accessMode: 'LOCAL_GUIDED', startedAt: lab.startedAt?.toISOString(), expiresAt: lab.expiresAt.toISOString(), remainingSeconds: ttl, running: true };
  }

  async labStatus(slug: string, user: LearningRecord) {
    const challenge = await this.challengeBySlug(slug);
    return { session: await this.sessionFor(user.id, challenge.id), resourceHealth: { status: 'READY' } };
  }

  async refreshLab(slug: string, user: LearningRecord) {
    const challenge = await this.challengeBySlug(slug);
    const lab = await this.prisma.labInstance.findFirst({ where: { userId: user.id, challengeId: challenge.id, status: 'RUNNING', expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } });
    if (!lab) this.fail(404, 'LAB_NOT_RUNNING', 'No guided session is running for this challenge.');
    const expiresAt = new Date(Date.now() + Math.max(60, Number(process.env.LAB_TTL_SECONDS ?? 1800)) * 1000);
    await this.prisma.$transaction([
      this.prisma.labInstance.update({ where: { id: lab.id }, data: { expiresAt } }),
      this.prisma.activity.create({ data: { userId: user.id, type: 'LAB_REFRESH', metadata: { challengeId: challenge.id, message: `Refreshed a guided session for ${challenge.title}.` } } }),
    ]);
    return { session: await this.sessionFor(user.id, challenge.id) };
  }

  async stopLab(slug: string, user: LearningRecord) {
    const challenge = await this.challengeBySlug(slug);
    const lab = await this.prisma.labInstance.findFirst({ where: { userId: user.id, challengeId: challenge.id, status: 'RUNNING', expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } });
    if (!lab) this.fail(404, 'LAB_NOT_RUNNING', 'No guided session is running for this challenge.');
    await this.prisma.$transaction([
      this.prisma.labInstance.update({ where: { id: lab.id }, data: { status: 'STOPPED', stoppedAt: new Date() } }),
      this.prisma.activity.create({ data: { userId: user.id, type: 'LAB_STOP', metadata: { challengeId: challenge.id, message: `Stopped a guided session for ${challenge.title}.` } } }),
    ]);
    return { session: await this.sessionFor(user.id, challenge.id), message: 'Guided learning session stopped.' };
  }

  async rangeOverview(user?: LearningRecord) {
    const [availableTasks, solved, sessions] = await Promise.all([
      this.prisma.challenge.count({ where: { isActive: true } }),
      this.solvedIds(user),
      user ? this.prisma.labInstance.findMany({ where: { userId: user.id, status: 'RUNNING', expiresAt: { gt: new Date() }, challenge: { isActive: true } }, include: { challenge: true }, orderBy: { expiresAt: 'asc' } }) : Promise.resolve([]),
    ]);
    const tasks = await this.listChallenges(user);
    return {
      metrics: { availableTasks, activeSessions: sessions.length, completed: solved.size, attachments: 0 },
      sessions: sessions.map((lab) => ({ instanceId: lab.id, status: lab.status, slug: lab.challenge.slug, title: lab.challenge.title, category: lab.challenge.category, expiresAt: lab.expiresAt.toISOString(), expiresInMinutes: Math.max(0, Math.ceil((lab.expiresAt.getTime() - Date.now()) / 60_000)) })),
      tasks: tasks.filter((task) => !task.solved),
    };
  }

  async dashboardStats(user?: LearningRecord) {
    await this.prisma.labInstance.updateMany({ where: { status: 'RUNNING', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED', stoppedAt: new Date() } });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [users, challenges, solves, runningLabs, solvesToday] = await Promise.all([
      this.prisma.user.count(), this.prisma.challenge.count({ where: { isActive: true } }), this.prisma.challengeSolve.count(),
      this.prisma.labInstance.count({ where: { status: 'RUNNING', expiresAt: { gt: new Date() } } }),
      this.prisma.challengeSolve.count({ where: { solvedAt: { gte: startOfDay } } }),
    ]);
    return { activeUsers: users, registeredUsers: users, totalChallenges: challenges, totalSolves: solves, runningLabs, onlineUsers: user ? 1 : 0, solvesToday };
  }

  async dashboardEvents() {
    const activities = await this.prisma.activity.findMany({ include: { user: { select: { username: true } } }, orderBy: { createdAt: 'desc' }, take: 12 });
    return activities.map((activity) => ({ username: activity.user.username, type: activity.type, message: typeof activity.metadata === 'object' && activity.metadata && 'message' in activity.metadata ? String((activity.metadata as any).message) : activity.type, createdAt: activity.createdAt.toISOString() }));
  }

  async leaderboard() {
    const users = await this.prisma.user.findMany({ orderBy: [{ score: 'desc' }, { createdAt: 'asc' }], include: { _count: { select: { solves: true } } }, take: 100 });
    return users.map((user, index) => ({ id: user.id, rank: index + 1, username: user.username, level: user.level, score: user.score, solved: user._count.solves }));
  }

  async skillGraph() {
    const skills = await this.prisma.skill.findMany({ orderBy: { slug: 'asc' } });
    return { nodes: skills.map((skill) => ({ slug: skill.slug, name: skill.name, category: skill.category, description: skill.description, x: skill.x, y: skill.y })), edges: [] };
  }

  async userSkills(user: LearningRecord) {
    const [skills, userSkills] = await Promise.all([
      this.prisma.skill.findMany({ orderBy: { slug: 'asc' } }), this.prisma.userSkill.findMany({ where: { userId: user.id } }),
    ]);
    const userSkillById = new Map(userSkills.map((item) => [item.skillId, item]));
    return skills.map((skill) => {
      const progress = userSkillById.get(skill.id);
      const xp = progress?.xp ?? 0;
      return { skill: { slug: skill.slug, name: skill.name, category: skill.category, description: skill.description }, xp, level: progress?.level ?? Math.max(1, Math.floor(xp / 100) + 1), status: progress?.status ?? 'AVAILABLE' };
    });
  }

  async learningOverview(user?: LearningRecord) {
    const [courses, progress] = await Promise.all([
      this.prisma.course.findMany({ where: { isPublished: true }, orderBy: { title: 'asc' } }),
      user ? this.prisma.courseProgress.findMany({ where: { userId: user.id } }) : Promise.resolve([]),
    ]);
    const progressByCourse = new Map(progress.map((item) => [item.courseId, item]));
    const skillXp = user ? (await this.prisma.userSkill.aggregate({ where: { userId: user.id }, _sum: { xp: true } }))._sum.xp ?? 0 : 0;
    return {
      summary: { courseCount: courses.length, finished: progress.filter((item) => item.completedAt !== null).length, skillXp },
      courses: courses.map((course) => ({ ...course, progress: progressByCourse.get(course.id)?.progress ?? 0, completed: Boolean(progressByCourse.get(course.id)?.completedAt) })),
    };
  }

  attackScenario() {
    return {
      description: 'This isolated teaching scenario explains how alerts, investigation, and defensive controls relate. It does not contact external targets.',
      phases: [
        ['01', '00:02', 'External reconnaissance alert', 'T1595', 'Record evidence before responding.'],
        ['02', '00:12', 'Web service fingerprint', 'T1592', 'Include public-service context in risk assessment.'],
        ['03', '00:25', 'Initial-access simulation', 'T1190', 'Model a high-risk web alert without exploitation.'],
        ['04', '00:46', 'Privilege-boundary review', 'T1068', 'Verify least privilege and patching controls.'],
        ['05', '01:10', 'Lateral-movement block', 'T1021', 'Use segmentation to limit spread.'],
        ['06', '01:55', 'Exfiltration control loop', 'T1041', 'Record response outcomes and improvements.'],
      ].map(([id, time, title, mitre, detail]) => ({ id, time, title, mitre, detail })),
      controls: [
        { name: 'Network segmentation', status: 'Enabled', description: 'Restricts non-essential paths.' },
        { name: 'Least privilege', status: 'Enabled', description: 'Reduces account-misuse impact.' },
        { name: 'Audit logging', status: 'Enabled', description: 'Retains evidence for review.' },
      ],
    };
  }

  async aiChat(user: LearningRecord, message: string, challengeId?: string, hintLevel = 1) {
    if (!message.trim()) this.fail(400, 'VALIDATION_FAILED', 'Enter a question for the learning assistant.');
    const challenge = challengeId ? await this.challengeBySlug(challengeId) : undefined;
    await this.prisma.activity.create({ data: { userId: user.id, type: 'AI_TUTOR', metadata: { challengeId: challenge?.id, hintLevel, message: 'Used the safety-first learning assistant.' } } });
    const guidance = hintLevel >= 3
      ? 'Split the task into input, processing, and output; list evidence you can verify before forming a conclusion.'
      : 'Describe the evidence you have, then test one minimal hypothesis using only the provided materials or guided session.';
    return { content: `${challenge ? `For ${challenge.title}: ` : ''}${guidance} Your question was: “${message.trim().slice(0, 240)}”. This assistant does not provide flags, arbitrary commands, or external attack steps.`, provider: 'mock-prisma' };
  }

  catalogSources() { return []; }
}
