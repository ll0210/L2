<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from './stores/auth';

const router=useRouter(), route=useRoute(), auth=useAuth();
const mode=ref<'login'|'register'>('login');
const username=ref(''), email=ref('demo@cyberquest.local'), password=ref('CyberQuest123!');
const error=ref(''), submitting=ref(false), show=ref(false);
async function submit(){
  error.value=''; submitting.value=true;
  try { if(mode.value==='login') await auth.login(email.value,password.value); else await auth.register({username:username.value,email:email.value,password:password.value}); const redirect=typeof route.query.redirect==='string'&&route.query.redirect.startsWith('/')?route.query.redirect:'/'; router.push(redirect); }
  catch(e:any){ error.value=e.message||'操作未完成，请检查输入后重试。'; }
  finally { submitting.value=false; }
}
function useDemo(){ mode.value='login';email.value='demo@cyberquest.local';password.value='CyberQuest123!';error.value=''; }
</script>

<template>
  <section class="login-page">
    <div class="login-side"><span class="eyebrow">欢迎来到赛博演武场</span><h1>把每一次<br><em>好奇</em>变成能力</h1><p>注册后即可在本机保存学习档案、训练记录、积分和技能成长。所有练习围绕授权的教学内容进行。</p><div class="feature"><b>01</b><span><strong>本地数据保存</strong><small>无需 Docker，关闭浏览器后记录仍保留。</small></span></div><div class="feature"><b>02</b><span><strong>真实学习闭环</strong><small>完成任务后积分、排行榜与技能会同步更新。</small></span></div></div>
    <form class="login-card" @submit.prevent="submit"><div class="tabs-login"><button type="button" :class="{active:mode==='login'}" @click="mode='login';error=''">登录</button><button type="button" :class="{active:mode==='register'}" @click="mode='register';error=''">创建账户</button></div><h2>{{mode==='login'?'欢迎回来':'创建你的学习档案'}}</h2><p class="muted">{{mode==='login'?'使用已有账户继续你的训练。':'只需一个昵称、邮箱和安全密码。'}}</p><label v-if="mode==='register'">昵称<input v-model.trim="username" required minlength="2" placeholder="例如：安全新生"></label><label>邮箱<input v-model.trim="email" required type="email" placeholder="name@example.com"></label><label>密码<div class="password"><input v-model="password" required minlength="8" :type="show?'text':'password'" placeholder="至少 8 位"><button type="button" @click="show=!show">{{show?'隐藏':'显示'}}</button></div></label><p v-if="error" class="alert">{{error}}</p><button class="submit" :disabled="submitting">{{submitting?'正在处理…':mode==='login'?'登录并继续':'创建账户并开始'}}</button><button v-if="mode==='login'" type="button" class="demo" @click="useDemo">填入体验账号</button><p v-if="mode==='login'" class="tip">体验账号：demo@cyberquest.local</p></form>
  </section>
</template>
