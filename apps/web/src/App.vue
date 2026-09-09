<script setup lang="ts">
import { useAuth } from './stores/auth'
const auth = useAuth()
</script>

<template>
  <header>
    <RouterLink class="brand" to="/"><i></i>赛博<span>演武场</span><small>安全实战学习平台</small></RouterLink>
    <nav>
      <RouterLink to="/challenges">靶场挑战</RouterLink><RouterLink to="/range">训练环境</RouterLink>
      <RouterLink to="/attack-map">攻击推演</RouterLink><RouterLink to="/skills">能力图谱</RouterLink>
      <RouterLink to="/learning">学习中心</RouterLink><RouterLink to="/leaderboard">英雄榜</RouterLink>
    </nav>
    <div class="top-status"><b></b>系统运行中</div>
    <RouterLink v-if="!auth.user" class="login" to="/login">登录平台</RouterLink>
    <button v-else class="ghost" @click="auth.logout()">{{ auth.user.username }} · 退出</button>
  </header>
  <main><RouterView /></main>
</template>
