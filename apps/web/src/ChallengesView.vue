<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from './api';
import { useAuth } from './stores/auth';

const auth=useAuth();
const challenges=ref<any[]>([]), sources=ref<any[]>([]), loading=ref(true), error=ref(''), search=ref(''), category=ref('全部');
const labels:any={WEB:'网页安全',CRYPTO:'密码学',NETWORK:'网络分析',REVERSE:'逆向工程',PWN:'二进制安全'};
const tones:any={WEB:'cyan',CRYPTO:'violet',NETWORK:'green',REVERSE:'orange',PWN:'pink'};
const categories=['全部','网页安全','密码学','网络分析','逆向工程','二进制安全'];
const filtered=computed(()=>challenges.value.filter(item=>{
  const haystack=`${item.title} ${item.description} ${item.tags?.join(' ')}`.toLowerCase();
  return (category.value==='全部'||labels[item.category]===category.value)&&haystack.includes(search.value.toLowerCase());
}));
async function load(){loading.value=true;error.value='';try{const [taskData,sourceData]=await Promise.all([api<any[]>('/challenges'),api<any[]>('/catalog/sources')]);challenges.value=taskData;sources.value=sourceData}catch(e:any){error.value=e.message||'题库暂时无法加载。'}finally{loading.value=false}}
onMounted(load);
</script>

<template>
  <section class="page catalog-page">
    <div class="catalog-head"><div><span class="eyebrow">训练任务库 / 本地持久化题目</span><h1 class="page-title">从一条线索，走到一次验证</h1><p class="subtitle">题目、附件、提示成本与提交记录均由当前本地后端提供；仅在受控教学目标中练习。</p></div><div class="catalog-counter"><b>{{ challenges.length }}</b><span>可用训练任务</span></div></div>
    <div class="catalog-tools"><label><span>检索题目</span><input v-model="search" placeholder="题目名称、标签或知识点"></label><button class="outline" @click="search='';category='全部'">重置筛选</button></div>
    <div class="catalog-tabs"><button v-for="item in categories" :key="item" :class="{active:category===item}" @click="category=item">{{ item }}</button></div>
    <section v-if="sources.length" class="source-hub"><div class="source-hub-heading"><span class="eyebrow">外部真实题源</span><h2>去官方平台完成公开挑战</h2><p>以下链接由后端维护，点击后会离开本站进入题目主办方平台；账号、Flag 与积分由原平台负责。</p></div><div class="source-list"><a v-for="source in sources" :key="source.id" :href="source.url" target="_blank" rel="noopener" class="source-item" :class="source.accent"><span>{{ source.category }}</span><b>{{ source.name }}</b><p>{{ source.description }}</p><small>{{ source.operator }} · {{ source.accountRequired?'需要官方账号':'可直接开始' }} <i>↗</i></small></a></div></section>
    <div v-if="loading" class="catalog-state">正在从本地训练服务读取任务…</div>
    <div v-else-if="error" class="catalog-state"><b>题库未能加载</b><p>{{ error }}</p><button @click="load">重新连接</button></div>
    <div v-else class="catalog-grid"><RouterLink v-for="item in filtered" :key="item.id" :to="`/challenges/${item.slug}`" class="mission-card" :class="[tones[item.category],{locked:item.available===false}]"><div class="mission-card-top"><span class="catalog-tag">{{ labels[item.category] }}</span><span class="difficulty">{{ item.difficulty }}</span></div><h2>{{ item.title }}</h2><p>{{ item.description }}</p><div class="chip-row"><i v-for="tag in item.tags?.slice(0,3)" :key="tag">{{ tag }}</i></div><div class="mission-meta"><span v-if="item.hasConnection">受控靶场</span><span v-if="item.attachmentCount">{{ item.attachmentCount }} 个附件</span><span>{{ item.solves }} 次完成</span></div><footer><b>{{ item.points }} 分</b><span v-if="item.solved" class="complete">已完成</span><span v-else-if="item.available===false" class="requires">需完成前置题</span><span v-else>{{ auth.user?'进入工作台':'登录后可提交' }} →</span></footer></RouterLink></div>
    <div v-if="!loading&&!error&&!filtered.length" class="catalog-state">没有匹配题目，试试更短的关键词。</div>
  </section>
</template>
