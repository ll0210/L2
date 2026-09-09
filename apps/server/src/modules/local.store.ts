import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningRepository } from './learning.repository';
const jwt = require('jsonwebtoken') as { sign: (payload: object, secret: string, options: { expiresIn: string }) => string; verify: (token: string, secret: string) => unknown };

type RecordData = Record<string, any>;

const SKILLS = [
  ['http', 'HTTP 与信任边界', 'WEB', '理解请求、Cookie 与输入验证的基础。'],
  ['crypto-basics', '编码与密码基础', 'CRYPTO', '识别编码、哈希与基础密码学概念。'],
  ['packet-analysis', '流量分析', 'NETWORK', '从协议、时序与响应中建立证据。'],
  ['reverse-basics', '静态分析', 'REVERSE', '从可读字符串和控制流形成假设。'],
  ['memory-safety', '内存安全', 'PWN', '理解边界检查和安全编码原则。'],
] as const;

const TAGS: Record<string, string[]> = {
  WEB: ['HTTP', '参数校验', '信任边界'], CRYPTO: ['编码', '数据表示', '可验证步骤'],
  NETWORK: ['DNS', 'HTTP', '流量分析'], REVERSE: ['Strings', '静态分析', '程序意图'], PWN: ['边界检查', '内存安全', '安全编码'],
};

@Injectable()
export class LocalStoreService implements LearningRepository {
  private readonly dataPath = join(process.cwd(), 'data', 'cyberquest.local.json');
  private readonly seedPath = join(process.cwd(), 'data', 'cyberquest.seed.json');
  private readonly tokenSecret = process.env.JWT_ACCESS_SECRET || 'cyberquest-local-development-secret';
  private readonly rateWindows = new Map<string, number[]>();
  private data: RecordData;

  constructor() { this.data = this.readData(); this.expireSessions(); }

  private readData(): RecordData {
    if (!existsSync(this.dataPath) && existsSync(this.seedPath)) copyFileSync(this.seedPath, this.dataPath);
    if (!existsSync(this.dataPath)) return { users: [], challenges: [], attempts: [], labs: [], courses: [] };
    try {
      const parsed = JSON.parse(readFileSync(this.dataPath, 'utf8'));
      return { users: Array.isArray(parsed.users) ? parsed.users : [], challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [], attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [], labs: Array.isArray(parsed.labs) ? parsed.labs : [], courses: Array.isArray(parsed.courses) ? parsed.courses : [] };
    } catch { throw new Error('本地学习数据无法读取。请修复 apps/server/data/cyberquest.local.json 后重试。'); }
  }

  private persist() {
    const temporary = `${this.dataPath}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    renameSync(temporary, this.dataPath);
  }

  private now() { return new Date().toISOString(); }
  private sha256(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
  private publicUser(user: RecordData) { return { id: user.id, username: user.username, email: user.email, role: user.role, score: user.score ?? 0, xp: user.xp ?? 0, level: user.level ?? 1 }; }
  private signUser(user: RecordData) { return jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.tokenSecret, { expiresIn: '15m' }); }
  private activity(user: RecordData, type: string, message: string) { user.activities ??= []; user.activities.push({ type, message, createdAt: this.now() }); }

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
    const current = Date.now();
    const entries = (this.rateWindows.get(key) ?? []).filter((time) => current - time < milliseconds);
    if (entries.length >= max) this.fail(429, 'RATE_LIMITED', '请求过于频繁，请稍后重试。');
    entries.push(current); this.rateWindows.set(key, entries);
  }

  userFromAuthorization(header?: string): RecordData | undefined {
    if (!header?.startsWith('Bearer ')) return undefined;
    try {
      const payload = jwt.verify(header.slice(7), this.tokenSecret) as { sub?: string };
      return this.data.users.find((item: RecordData) => item.id === payload.sub);
    } catch { this.fail(401, 'AUTH_TOKEN_EXPIRED', '访问令牌无效或已过期。'); }
  }

  requireUser(header?: string) {
    const user = this.userFromAuthorization(header);
    if (!user) this.fail(401, 'AUTH_FORBIDDEN', '请先登录后再执行该操作。');
    return user;
  }

  async login(email: string, password: string) {
    const user = this.data.users.find((item: RecordData) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !(await argon2.verify(user.passwordHash, password))) this.fail(401, 'AUTH_INVALID_CREDENTIALS', '邮箱或密码错误。');
    user.lastLoginAt = this.now(); this.activity(user, 'LOGIN', '登录本地学习平台'); this.persist();
    return { user: this.publicUser(user), accessToken: this.signUser(user) };
  }

  async register(input: { username?: string; email?: string; password?: string }) {
    const username = input.username?.trim(); const email = input.email?.trim().toLowerCase();
    if (!username || username.length < 2 || !email || !/^\S+@\S+\.\S+$/.test(email) || !input.password || input.password.length < 8) this.fail(400, 'VALIDATION_FAILED', '请填写昵称、有效邮箱和至少 8 位密码。');
    if (this.data.users.some((item: RecordData) => item.email.toLowerCase() === email || item.username === username)) this.fail(409, 'AUTH_ACCOUNT_EXISTS', '邮箱或昵称已被使用。');
    const user = { id: randomUUID(), username, email, passwordHash: await argon2.hash(input.password), role: 'USER', score: 0, xp: 0, level: 1, solved: [], skills: {}, activities: [], unlockedHints: {}, createdAt: this.now() };
    this.data.users.push(user); this.activity(user, 'REGISTER', '创建本地学习档案'); this.persist();
    return { user: this.publicUser(user), accessToken: this.signUser(user) };
  }

  me(user: RecordData) { return this.publicUser(user); }
  private challengeBySlug(slug: string) {
    const challenge = this.data.challenges.find((item: RecordData) => item.slug === slug || item.id === slug);
    if (!challenge) this.fail(404, 'CHALLENGE_NOT_FOUND', '题目不存在或尚未发布。');
    return challenge;
  }
  private challengeById(id: string) { return this.data.challenges.find((challenge: RecordData) => challenge.id === id); }

  private sessionFor(user: RecordData | undefined, challenge: RecordData) {
    if (!user) return { status: 'STOPPED', running: false, requiresLogin: true, remainingSeconds: 0 };
    this.expireSessions();
    const lab = [...this.data.labs].reverse().find((item: RecordData) => item.userId === user.id && item.challengeId === challenge.id && item.status === 'RUNNING');
    if (!lab) return { status: 'STOPPED', running: false, requiresLogin: false, remainingSeconds: 0 };
    const remainingSeconds = Math.max(0, Math.ceil((new Date(lab.expiresAt).getTime() - Date.now()) / 1000));
    return { ...lab, running: remainingSeconds > 0, remainingSeconds };
  }

  private hintsFor(challenge: RecordData, user?: RecordData) {
    return (challenge.hints ?? []).map((hint: RecordData, index: number) => {
      const id = `${challenge.id}:${index + 1}`; const unlocked = hint.cost === 0 || Boolean(user?.unlockedHints?.[id]);
      return { id, title: hint.title, cost: hint.cost ?? 0, order: index + 1, unlocked, ...(unlocked ? { content: hint.content } : {}) };
    });
  }

  private recentAttempts(user: RecordData | undefined, challenge: RecordData) {
    if (!user) return [];
    return this.data.attempts.filter((attempt: RecordData) => attempt.userId === user.id && attempt.challengeId === challenge.id).slice(-5).reverse().map((attempt: RecordData) => ({ id: attempt.id, correct: attempt.correct, createdAt: attempt.createdAt }));
  }

  private challengeView(challenge: RecordData, user?: RecordData, detailed = false) {
    const solved = Boolean(user?.solved?.includes(challenge.id)); const attempts = this.recentAttempts(user, challenge);
    const result: RecordData = { id: challenge.id, slug: challenge.slug, title: challenge.title, category: challenge.category, difficulty: challenge.difficulty, points: challenge.points, description: challenge.description, goal: challenge.goal, tags: TAGS[challenge.category] ?? ['安全训练'], solves: Array.isArray(challenge.solves) ? challenge.solves.length : 0, solved, available: true, attachmentCount: Array.isArray(challenge.attachments) ? challenge.attachments.length : 0, hasConnection: Boolean(challenge.connection) };
    if (detailed) {
      result.hints = this.hintsFor(challenge, user); result.attachments = Array.isArray(challenge.attachments) ? challenge.attachments : []; result.connection = challenge.connection;
      result.workspace = { session: this.sessionFor(user, challenge), recentSubmissions: attempts, submissionStats: { total: attempts.length, correct: attempts.filter((item: RecordData) => item.correct).length }, resourceHealth: { status: 'READY' }, nextChallenge: this.nextChallenge(user, challenge) };
      result.attempts = attempts; result.submissionStats = result.workspace.submissionStats;
    }
    return result;
  }

  listChallenges(user?: RecordData) { return this.data.challenges.map((challenge: RecordData) => this.challengeView(challenge, user)); }
  challengeDetail(slug: string, user?: RecordData) { return this.challengeView(this.challengeBySlug(slug), user, true); }
  workspace(slug: string, user: RecordData) {
    const challenge = this.challengeBySlug(slug); const attempts = this.recentAttempts(user, challenge);
    return { session: this.sessionFor(user, challenge), recentSubmissions: attempts, submissionStats: { total: attempts.length, correct: attempts.filter((item: RecordData) => item.correct).length }, resourceHealth: { status: 'READY' }, nextChallenge: this.nextChallenge(user, challenge) };
  }
  private nextChallenge(user: RecordData | undefined, current: RecordData) {
    if (!user) return undefined;
    const next = this.data.challenges.find((challenge: RecordData) => challenge.id !== current.id && !user.solved?.includes(challenge.id));
    return next ? { slug: next.slug, title: next.title } : undefined;
  }

  submit(slug: string, user: RecordData, flag: string) {
    const challenge = this.challengeBySlug(slug);
    if (!flag?.trim()) this.fail(400, 'VALIDATION_FAILED', '请输入 Flag 后再提交。');
    const correct = this.sha256(flag.trim()) === challenge.flagHash;
    this.data.attempts.push({ id: randomUUID(), userId: user.id, challengeId: challenge.id, submittedHash: this.sha256(flag.trim()), correct, createdAt: this.now() });
    if (!correct) { this.activity(user, 'FLAG_ATTEMPT', `尝试「${challenge.title}」但尚未通过验证`); this.persist(); return { success: false, message: 'Flag incorrect', attempts: this.recentAttempts(user, challenge) }; }
    if (user.solved?.includes(challenge.id)) { this.persist(); return { success: true, alreadySolved: true, message: '该题已完成，积分不会重复计算。', newScore: user.score, attempts: this.recentAttempts(user, challenge) }; }
    user.solved = [...(user.solved ?? []), challenge.id]; challenge.solves = [...(challenge.solves ?? []), user.id]; user.score = (user.score ?? 0) + challenge.points; user.xp = (user.xp ?? 0) + challenge.points; user.skills ??= {};
    const skillRewards = (challenge.skills ?? []).map((reward: RecordData) => { user.skills[reward.slug] = (user.skills[reward.slug] ?? 0) + reward.xp; return { skillSlug: reward.slug, xp: reward.xp, newLevel: this.skillLevel(user.skills[reward.slug]) }; });
    user.level = Math.max(1, Math.floor(user.xp / 250) + 1); this.activity(user, 'CHALLENGE_SOLVE', `完成「${challenge.title}」`); this.persist();
    return { success: true, points: challenge.points, newScore: user.score, isFirstBlood: challenge.solves.length === 1, skillRewards, attempts: this.recentAttempts(user, challenge) };
  }

  unlockHint(slug: string, hintId: string, user: RecordData) {
    const challenge = this.challengeBySlug(slug); const index = Number(hintId.split(':').at(-1)) - 1; const hint = challenge.hints?.[index];
    if (!hint) this.fail(404, 'HINT_NOT_FOUND', '提示不存在。'); user.unlockedHints ??= {}; const id = `${challenge.id}:${index + 1}`;
    if (user.unlockedHints[id] || hint.cost === 0) this.fail(409, 'HINT_ALREADY_UNLOCKED', '该提示已解锁。');
    if ((user.score ?? 0) < hint.cost) this.fail(400, 'INSUFFICIENT_POINTS', '积分不足，无法解锁该提示。');
    user.score -= hint.cost; user.unlockedHints[id] = true; this.activity(user, 'HINT_UNLOCK', `解锁「${challenge.title}」提示 ${index + 1}`); this.persist();
    return { content: hint.content, cost: hint.cost, newScore: user.score };
  }

  startLab(user: RecordData, challengeId: string) {
    const challenge = this.challengeBySlug(challengeId); const existing = this.sessionFor(user, challenge);
    if (existing.running) return { ...existing, message: '当前题目的受控学习会话已在运行。' };
    const ttl = Number(process.env.LAB_TTL_SECONDS ?? 1800); const startedAt = this.now();
    const lab = { instanceId: randomUUID(), userId: user.id, challengeId: challenge.id, status: 'RUNNING', accessMode: 'LOCAL_GUIDED', startedAt, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), remainingSeconds: ttl, message: '本地受控学习会话已启动：仅可使用工作台中的固定教学命令，不会创建容器或访问外部目标。' };
    this.data.labs.push(lab); this.activity(user, 'LAB_START', `启动「${challenge.title}」本地受控会话`); this.persist(); return { ...lab, running: true };
  }

  labStatus(slug: string, user: RecordData) { return { session: this.sessionFor(user, this.challengeBySlug(slug)), resourceHealth: { status: 'READY' } }; }
  refreshLab(slug: string, user: RecordData) {
    const challenge = this.challengeBySlug(slug); const lab = [...this.data.labs].reverse().find((item: RecordData) => item.userId === user.id && item.challengeId === challenge.id && item.status === 'RUNNING');
    if (!lab) this.fail(404, 'LAB_NOT_RUNNING', '当前题目没有运行中的受控会话。');
    lab.expiresAt = new Date(Date.now() + Number(process.env.LAB_TTL_SECONDS ?? 1800) * 1000).toISOString(); this.activity(user, 'LAB_REFRESH', `延长「${challenge.title}」本地会话`); this.persist(); return { session: this.sessionFor(user, challenge) };
  }
  stopLab(slug: string, user: RecordData) {
    const challenge = this.challengeBySlug(slug); const lab = [...this.data.labs].reverse().find((item: RecordData) => item.userId === user.id && item.challengeId === challenge.id && item.status === 'RUNNING');
    if (!lab) this.fail(404, 'LAB_NOT_RUNNING', '当前题目没有运行中的受控会话。');
    lab.status = 'STOPPED'; lab.stoppedAt = this.now(); lab.remainingSeconds = 0; this.activity(user, 'LAB_STOP', `结束「${challenge.title}」本地会话`); this.persist(); return { session: this.sessionFor(user, challenge), message: '本地受控学习会话已结束。' };
  }

  rangeOverview(user?: RecordData) {
    this.expireSessions(); const sessions = user ? this.data.labs.filter((lab: RecordData) => lab.userId === user.id && lab.status === 'RUNNING').map((lab: RecordData) => { const challenge = this.challengeById(lab.challengeId); return { ...lab, slug: challenge?.slug, title: challenge?.title, category: challenge?.category, expiresInMinutes: Math.max(0, Math.ceil((new Date(lab.expiresAt).getTime() - Date.now()) / 60000)) }; }) : [];
    return { metrics: { availableTasks: this.data.challenges.length, activeSessions: sessions.length, completed: user?.solved?.length ?? 0, attachments: this.data.challenges.reduce((total: number, challenge: RecordData) => total + (challenge.attachments?.length ?? 0), 0) }, sessions, tasks: this.listChallenges(user).filter((item: RecordData) => !item.solved) };
  }

  dashboardStats(user?: RecordData) {
    this.expireSessions(); return { activeUsers: this.data.users.length, registeredUsers: this.data.users.length, totalChallenges: this.data.challenges.length, totalSolves: this.data.attempts.filter((attempt: RecordData) => attempt.correct).length, runningLabs: this.data.labs.filter((lab: RecordData) => lab.status === 'RUNNING').length, onlineUsers: user ? 1 : 0, solvesToday: this.data.attempts.filter((attempt: RecordData) => attempt.correct && attempt.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length };
  }
  dashboardEvents() { return this.data.users.flatMap((user: RecordData) => (user.activities ?? []).map((activity: RecordData) => ({ username: user.username, ...activity }))).sort((a: RecordData, b: RecordData) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12); }
  leaderboard() { return [...this.data.users].sort((a: RecordData, b: RecordData) => (b.score ?? 0) - (a.score ?? 0)).map((user: RecordData, index: number) => ({ id: user.id, rank: index + 1, username: user.username, level: user.level ?? 1, score: user.score ?? 0, solved: user.solved?.length ?? 0 })); }
  skillGraph() { return { nodes: SKILLS.map(([slug, name, category, description], index) => ({ slug, name, category, description, x: index % 3, y: Math.floor(index / 3) })), edges: [] }; }
  private skillLevel(xp: number) { return Math.max(1, Math.floor(xp / 100) + 1); }
  userSkills(user: RecordData) { return SKILLS.map(([slug, name, category, description]) => { const xp = user.skills?.[slug] ?? 0; return { skill: { slug, name, category, description }, xp, level: this.skillLevel(xp), status: xp > 0 ? 'LEARNING' : 'AVAILABLE' }; }); }
  learningOverview(user?: RecordData) { return { summary: { courseCount: this.data.courses.length, finished: user?.solved?.length ?? 0, skillXp: Object.values(user?.skills ?? {}).reduce((total: number, xp: any) => total + Number(xp), 0) }, courses: this.data.courses.map((course: RecordData) => ({ ...course, completed: Boolean(user?.solved?.some((id: string) => this.challengeById(id)?.slug === course.challengeSlug)) })) }; }
  attackScenario() { return { description: '这是不连接任何外部目标的教学推演，用于理解告警、调查和防护控制之间的关系。', phases: [['01', '00:02', '外部侦察告警', 'T1595', '识别到异常探测节奏，先记录证据而不是执行攻击。'], ['02', '00:12', 'Web 服务指纹', 'T1592', '把公开服务信息纳入风险评估。'], ['03', '00:25', '初始访问模拟', 'T1190', '教学情景中模拟 Web 服务高风险告警。'], ['04', '00:46', '权限边界检查', 'T1068', '验证最小权限和补丁策略是否有效。'], ['05', '01:10', '横向移动阻断', 'T1021', '分段和访问控制阻止横向扩散。'], ['06', '01:55', '外传防护闭环', 'T1041', '记录处置结果并形成改进项。']].map(([id, time, title, mitre, detail]) => ({ id, time, title, mitre, detail })), controls: [{ name: '网络分段', status: '已启用', description: '限制非必要路径。' }, { name: '最小权限', status: '已启用', description: '降低账户滥用影响。' }, { name: '审计记录', status: '已启用', description: '保留可复核证据。' }] }; }
  aiChat(user: RecordData, message: string, challengeId?: string, hintLevel = 1) { const challenge = challengeId ? this.challengeBySlug(challengeId) : undefined; this.activity(user, 'AI_TUTOR', '使用本地学习助手'); this.persist(); const advice = hintLevel >= 3 ? '把任务拆为输入、处理、输出，逐项列出能验证的证据；优先解释现象和工具输出，不要猜测最终答案。' : '先说明你看到了什么，再提出一个最小可验证假设；只在题目提供的材料或受控会话中验证。'; return { content: `${challenge ? `当前题目「${challenge.title}」` : '当前学习目标'}：${advice} 你提出的问题是“${message.slice(0, 240)}”。本助手不会提供 Flag、任意命令或外部攻击步骤。`, provider: 'mock-local' }; }
  catalogSources() { return []; }
  private expireSessions() { let changed = false; for (const lab of this.data.labs ?? []) { if (lab.status === 'RUNNING' && new Date(lab.expiresAt).getTime() <= Date.now()) { lab.status = 'EXPIRED'; lab.remainingSeconds = 0; lab.expiredAt = this.now(); changed = true; } } if (changed) this.persist(); }
}
