<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from './api';
import { useAuth } from './stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const challenge = ref<any>();
const workspace = ref<any>();
const loadError = ref('');
const flag = ref('');
const result = ref('');
const resultTone = ref<'good' | 'error' | ''>('');
const command = ref('');
const tutorQuestion = ref('');
const tutor = ref('');
const action = ref('');
const targetState = ref<'checking' | 'ready' | 'error'>('checking');
const reviewOpen = ref(false);
const activeWorkspaceTab = ref<'brief' | 'resources' | 'terminal'>('brief');
const now = ref(Date.now());
const terminal = ref('本地受控终端已就绪。\n输入「帮助」查看本题允许的学习命令。');
let clock: ReturnType<typeof setInterval> | undefined;
let statusPoll: ReturnType<typeof setInterval> | undefined;

const categoryNames: Record<string, string> = {
  WEB: '网页安全', CRYPTO: '密码学', NETWORK: '网络分析', REVERSE: '逆向工程', PWN: '二进制安全',
};
const base = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3000/api`;
const targetHref = computed(() => challenge.value?.labUrl ? `${base.replace(/\/api$/, '')}${challenge.value.labUrl}` : '');
const canWork = computed(() => challenge.value?.available !== false);
const nextChallenge = computed(() => challenge.value?.nextChallengeMeta ?? workspace.value?.nextChallenge);
const nextRoute = computed(() => {
  const slug = nextChallenge.value?.slug ?? challenge.value?.nextChallenge;
  return slug ? `/challenges/${slug}` : '';
});
const session = computed(() => workspace.value?.session ?? challenge.value?.workspaceStatus ?? {});
const sessionRunning = computed(() => session.value?.running === true || session.value?.status === 'RUNNING');
const sessionRequiresLogin = computed(() => session.value?.requiresLogin === true || !auth.token);
const resourceHealth = computed(() => workspace.value?.resourceHealth ?? challenge.value?.resourceHealth);
const recentAttempts = computed(() => workspace.value?.recentSubmissions ?? challenge.value?.attempts ?? []);
const attemptStats = computed(() => workspace.value?.submissionStats ?? challenge.value?.submissionStats);
const remainingSeconds = computed(() => {
  const expiresAt = session.value?.expiresAt;
  if (sessionRunning.value && expiresAt) return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.value) / 1000));
  return Math.max(0, Number(session.value?.remainingSeconds ?? 0));
});
const remainingLabel = computed(() => {
  const seconds = remainingSeconds.value;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});
const sessionStateText = computed(() => {
  if (sessionRequiresLogin.value) return '登录后可启动';
  if (sessionRunning.value) return '受控会话运行中';
  if (session.value?.status === 'EXPIRED') return '会话已到期';
  if (session.value?.status === 'STOPPED') return '会话已结束';
  return '尚未启动';
});

function showResult(message: string, tone: 'good' | 'error' | '' = '') {
  result.value = message;
  resultTone.value = tone;
}

function formatTime(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

async function checkTarget() {
  if (!targetHref.value) { targetState.value = 'ready'; return; }
  targetState.value = 'checking';
  try {
    const response = await fetch(targetHref.value, { method: 'GET' });
    targetState.value = response.ok ? 'ready' : 'error';
  } catch {
    targetState.value = 'error';
  }
}

async function syncWorkspace() {
  if (!auth.token) return;
  workspace.value = await api(`/challenges/${route.params.id}/workspace`);
}

async function syncSessionStatus() {
  if (!auth.token || !challenge.value) return;
  const snapshot: any = await api(`/labs/${route.params.id}/status`);
  workspace.value = { ...workspace.value, session: snapshot.session, resourceHealth: snapshot.resourceHealth };
}

async function load() {
  try {
    loadError.value = '';
    challenge.value = await api(`/challenges/${route.params.id}`);
    workspace.value = challenge.value.workspace;
    if (auth.token) await syncWorkspace();
    await checkTarget();
  } catch (error: any) {
    loadError.value = error.message || '无法连接训练服务。请确认本地后端仍在运行。';
  }
}

function updateScore(score: number) {
  if (!auth.user) return;
  auth.user = { ...auth.user, score };
  localStorage.setItem('cq_user', JSON.stringify(auth.user));
}

async function submit() {
  if (!auth.token) { showResult('请先登录后再提交答案。', 'error'); return; }
  try {
    const response: any = await api(`/challenges/${route.params.id}/submit`, { method: 'POST', body: JSON.stringify({ flag: flag.value }) });
    if (response.newScore !== undefined) updateScore(response.newScore);
    if (response.success) {
      challenge.value.solved = true;
      challenge.value.attempts = response.attempts;
      flag.value = '';
      showResult(response.message || `验证通过，已获得 ${response.points || 0} 积分。`, 'good');
      await syncWorkspace();
    } else {
      challenge.value.attempts = response.attempts;
      showResult(response.message || '答案未通过，请回到题目目标检查证据链。', 'error');
      await syncWorkspace();
    }
  } catch (error: any) {
    showResult(error.message || '提交失败，请稍后再试。', 'error');
  }
}

async function startSession() {
  if (!auth.token) { await router.push({ path: '/login', query: { redirect: route.fullPath } }); return; }
  try {
    const response: any = await api('/labs/start', { method: 'POST', body: JSON.stringify({ challengeId: route.params.id }) });
    showResult(response.message || '本地受控学习会话已启动。', 'good');
    await syncSessionStatus();
  } catch (error: any) {
    showResult(error.message || '会话启动失败。', 'error');
  }
}

async function refreshSession() {
  try {
    const response: any = await api(`/labs/${route.params.id}/refresh`, { method: 'POST' });
    workspace.value = { ...workspace.value, session: response.session };
    showResult('会话已续期 30 分钟。', 'good');
  } catch (error: any) {
    showResult(error.message || '会话续期失败。', 'error');
  }
}

async function stopSession() {
  try {
    const response: any = await api(`/labs/${route.params.id}/stop`, { method: 'POST' });
    workspace.value = { ...workspace.value, session: response.session };
    showResult(response.message || '本地学习会话已结束。', 'good');
  } catch (error: any) {
    showResult(error.message || '结束会话失败。', 'error');
  }
}

async function unlock(hint: any) {
  if (hint.unlocked) return;
  if (!auth.token) { showResult('登录后才能用积分解锁提示。', 'error'); return; }
  action.value = hint.id;
  try {
    const response: any = await api(`/challenges/${route.params.id}/hints/${hint.id}/unlock`, { method: 'POST' });
    hint.unlocked = true;
    hint.content = response.content;
    updateScore(response.newScore);
    showResult(`已解锁提示，扣除 ${response.cost || 0} 积分。`, 'good');
    await syncWorkspace();
  } catch (error: any) {
    showResult(error.message || '提示暂时无法解锁。', 'error');
  } finally {
    action.value = '';
  }
}

function run() {
  const item = command.value.trim();
  if (!item) return;
  const commands: Record<string, string> = {
    帮助: '可用命令：帮助、任务目标、资源、我的状态、提示、清屏。',
    任务目标: challenge.value?.goal || '任务尚未加载。',
    资源: `${targetHref.value ? '网页靶场：资源区已提供受控本地链接。\n' : ''}${challenge.value?.attachments?.length ? `附件：${challenge.value.attachments.map((file: any) => file.label).join('、')}` : '本题没有附加文件。'}`,
    我的状态: auth.user ? `当前学员：${auth.user.username}\n积分：${auth.user.score ?? 0}\n训练会话：${sessionStateText.value}` : '尚未登录。',
    提示: challenge.value?.hints?.find((hint: any) => hint.unlocked)?.content || '先阅读任务目标，再选择一个可验证的观察。',
  };
  terminal.value = item === '清屏' ? '' : `${terminal.value}\n\n$ ${item}\n${commands[item] || '该命令不在允许列表中。输入「帮助」查看可用命令。'}`;
  command.value = '';
}

async function ask() {
  if (!auth.token) { tutor.value = '登录后可使用并保存学习助手记录。'; return; }
  if (!tutorQuestion.value.trim()) { tutor.value = '请描述你已观察到的字段、响应或附件内容。'; return; }
  try {
    const response: any = await api('/ai/chat', { method: 'POST', body: JSON.stringify({ message: tutorQuestion.value, challengeId: route.params.id, hintLevel: 2 }) });
    tutor.value = response.content;
  } catch (error: any) {
    tutor.value = error.message || '学习助手暂时不可用。';
  }
}

async function copyTarget() {
  try {
    await navigator.clipboard.writeText(targetHref.value);
    showResult('靶场链接已复制。局域网访问时，请把主机名替换为运行平台电脑的 IP。', 'good');
  } catch {
    showResult('浏览器未授予复制权限，请手动复制上方地址。', 'error');
  }
}

onMounted(() => {
  load();
  clock = setInterval(() => { now.value = Date.now(); }, 1000);
  statusPoll = setInterval(() => { syncSessionStatus().catch(() => undefined); }, 30000);
});
onUnmounted(() => { if (clock) clearInterval(clock); if (statusPoll) clearInterval(statusPoll); });
</script>

<template>
  <section v-if="challenge" class="page workspace-page focus-workspace">
    <header class="challenge-banner">
      <div class="task-title">
        <span class="eyebrow">训练工作台 / {{ categoryNames[challenge.category] || challenge.category }}</span>
        <h1>{{ challenge.title }}</h1>
        <p>{{ challenge.description }}</p>
        <div class="banner-tags"><i v-for="tag in challenge.tags" :key="tag">{{ tag }}</i></div>
      </div>
      <div class="banner-score">
        <span>本题积分</span><b>{{ challenge.points }}</b>
        <em :class="{ done: challenge.solved }">{{ challenge.solved ? '已完成' : '待验证' }}</em>
      </div>
    </header>

    <div class="workspace-layout challenge-workbench">
      <main class="challenge-surface">
        <section class="goal-panel">
          <div>
            <span class="eyebrow">任务目标</span>
            <h2>{{ challenge.goal }}</h2>
          </div>
          <div class="goal-status">
            <span>{{ challenge.solved ? '训练状态' : '有效完成' }}</span>
            <b>{{ challenge.solved ? '已验证' : challenge.solves + ' 次' }}</b>
          </div>
        </section>

        <nav class="workspace-tabs" aria-label="训练工作区">
          <button type="button" :class="{ active: activeWorkspaceTab === 'brief' }" @click="activeWorkspaceTab = 'brief'">
            <span>题目说明</span><small>目标与验证</small>
          </button>
          <button type="button" :class="{ active: activeWorkspaceTab === 'resources' }" @click="activeWorkspaceTab = 'resources'">
            <span>资源与靶场</span><small>{{ (challenge.connection ? 1 : 0) + (challenge.attachments?.length || 0) }} 项材料</small>
          </button>
          <button type="button" :class="{ active: activeWorkspaceTab === 'terminal' }" @click="activeWorkspaceTab = 'terminal'">
            <span>受控终端</span><small>本题命令</small>
          </button>
        </nav>

        <section v-show="activeWorkspaceTab === 'brief'" class="work-main" :class="{ 'is-solved': challenge.solved }">
          <header class="work-main-header">
            <div>
              <span class="eyebrow">{{ challenge.solved ? '验证结果' : '解题路径' }}</span>
              <h2>{{ challenge.solved ? '本题已通过验证' : '从证据到 Flag' }}</h2>
            </div>
            <span class="submission-count">{{ attemptStats?.total ?? recentAttempts.length }} 次提交</span>
          </header>

          <section v-if="challenge.solved" class="completion-panel">
            <div class="completion-mark">✓</div>
            <div>
              <b>成果已同步到学习档案</b>
              <p>积分、能力经验和提交记录均由本地后端保存；你仍可在“资源与靶场”及“受控终端”中复盘。</p>
            </div>
            <div class="completion-actions">
              <RouterLink v-if="nextRoute" :to="nextRoute">{{ nextChallenge?.title ? '下一题：' + nextChallenge.title : '进入下一题' }} →</RouterLink>
              <button class="outline" @click="reviewOpen = !reviewOpen">{{ reviewOpen ? '收起复盘' : '查看复盘' }}</button>
            </div>
          </section>

          <section v-else class="solve-flow">
            <ol>
              <li><i>01</i><div><b>收集线索</b><p>使用本题靶场或附件，先记录输入、处理、输出的可观察证据。</p></div></li>
              <li><i>02</i><div><b>验证结论</b><p>将线索与任务目标对应，得到可复现的结果。</p></div></li>
              <li><i>03</i><div><b>提交验证</b><p>提交 Flag 后，积分与能力会由后端实际更新。</p></div></li>
            </ol>
            <div class="submit-row"><input v-model="flag" :disabled="!canWork" @keyup.enter="submit" placeholder="输入 flag{...}"><button :disabled="!canWork" @click="submit">提交答案</button></div>
          </section>

          <p v-if="result" class="result" :class="resultTone">{{ result }}</p>

          <section v-if="challenge.solved && reviewOpen" class="review-panel">
            <span class="eyebrow">复盘清单</span><h2>保留这一次验证的关键证据</h2>
            <div>
              <p><i>01</i>任务目标：{{ challenge.goal }}</p>
              <p><i>02</i>已提交 {{ attemptStats?.total ?? recentAttempts.length }} 次，提交状态已保存到本地账号。</p>
              <p><i>03</i>下一步：把结论整理为可复现的笔记，再进入后续题目。</p>
            </div>
          </section>
        </section>

        <section v-show="activeWorkspaceTab === 'resources'" class="access-panel">
          <header><span class="eyebrow">训练资源</span><small>仅展示本题已登记的本地材料</small></header>
          <template v-if="challenge.connection || challenge.attachments?.length">
            <div v-if="challenge.connection" class="access-item">
              <span class="access-mark">↗</span>
              <div>
                <small>受控连接 / {{ challenge.connection.protocol }}</small><b>{{ challenge.connection.label }}</b>
                <p>{{ challenge.connection.description }}</p><code>{{ targetHref }}</code>
              </div>
              <div class="access-actions">
                <span class="target-health" :class="targetState">{{ targetState === 'ready' ? '靶场响应正常' : targetState === 'error' ? '靶场不可达' : '检测中' }}</span>
                <a :href="targetHref" target="_blank" rel="noopener">打开靶场</a><button class="outline" @click="copyTarget">复制地址</button>
              </div>
            </div>
            <div v-for="file in challenge.attachments" :key="file.name" class="access-item file">
              <span class="access-mark">⌁</span>
              <div><small>{{ file.kind }}</small><b>{{ file.label }}</b><p>{{ file.name }}</p></div>
              <a :href="base + '/challenges/' + challenge.slug + '/attachments/' + file.name">下载附件</a>
            </div>
          </template>
          <div v-else class="resource-empty">
            <b>本题不需要外部材料</b>
            <p>所有必要线索都在题目说明或受控终端中提供。</p>
          </div>
          <div v-if="resourceHealth" class="resource-note" :class="resourceHealth.status?.toLowerCase()">
            <span>{{ resourceHealth.status === 'READY' ? '本地材料已登记' : '材料状态需要注意' }}</span>
            <small>后端仅核验当前训练材料的本地元数据，不对外部地址发起探测。</small>
          </div>
        </section>

        <section v-show="activeWorkspaceTab === 'terminal'" class="terminal-block">
          <header><div><b>本地受控终端</b><small>仅支持本题学习命令</small></div><span>LOCAL</span></header>
          <pre>{{ terminal }}</pre><input v-model="command" @keyup.enter="run" placeholder="帮助、任务目标、资源、我的状态、提示">
        </section>
      </main>

      <aside class="work-context">
        <section class="session-card live-session-card">
          <header><span class="eyebrow">训练会话</span><em :class="{ active: sessionRunning }">{{ sessionStateText }}</em></header>
          <div class="session-meter">
            <div><span>本地受控学习</span><b v-if="sessionRunning">{{ remainingLabel }}</b><b v-else>—</b></div>
            <p v-if="sessionRunning">剩余有效时长，刷新后可续期 30 分钟</p>
            <p v-else-if="sessionRequiresLogin">登录后才能保存训练会话、提示和提交记录。</p>
            <p v-else>启动后会生成仅属于当前账号的本地学习会话。</p>
          </div>
          <div class="session-controls">
            <button v-if="!sessionRunning" :disabled="!canWork" @click="startSession">{{ sessionRequiresLogin ? '登录后启动会话' : '启动本地会话' }}</button>
            <template v-else>
              <button @click="refreshSession">续期 30 分钟</button><button class="outline danger" @click="stopSession">结束</button>
            </template>
          </div>
          <div class="attempt-box">
            <span>提交记录</span><b>{{ attemptStats?.total ?? recentAttempts.length }} 次</b>
            <p v-for="attempt in recentAttempts.slice(0, 2)" :key="attempt.id"><i :class="{ ok: attempt.correct }"></i>{{ attempt.correct ? '答案正确' : '尚未通过' }}<time>{{ formatTime(attempt.createdAt) }}</time></p>
            <p v-if="!recentAttempts.length" class="empty-attempt">尚无提交，先完成一条可验证的观察。</p>
          </div>
        </section>

        <section class="hints-card">
          <header><span class="eyebrow">分级提示</span><em>积分解锁</em></header>
          <article v-for="hint in challenge.hints" :key="hint.id" :class="{ open: hint.unlocked }">
            <div><small>提示 {{ hint.order }}</small><b>{{ hint.title }}</b><p v-if="hint.unlocked">{{ hint.content }}</p></div>
            <button v-if="!hint.unlocked" class="outline" :disabled="!!action" @click="unlock(hint)">{{ action === hint.id ? '解锁中' : hint.cost + ' 分' }}</button><span v-else>已获取</span>
          </article>
        </section>

        <section class="tutor-card">
          <span class="eyebrow">学习助手</span><h3>卡住时，先整理观察</h3>
          <p>描述你看到的字段、响应或附件内容，我会帮助你建立下一步验证思路。</p>
          <textarea v-model="tutorQuestion" placeholder="例如：我怎样证明一个请求参数不可信？"></textarea><button @click="ask">获取学习建议</button>
          <p v-if="tutor" class="tutor-answer">{{ tutor }}</p>
        </section>
      </aside>
    </div>
  </section>
  <section v-else class="page load-state"><div v-if="loadError"><h2>训练任务未能加载</h2><p>{{ loadError }}</p><button @click="load">重新加载</button></div><p v-else>正在载入训练任务…</p></section>
</template>
