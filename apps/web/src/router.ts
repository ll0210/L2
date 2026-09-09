import { createRouter,createWebHistory } from 'vue-router';
import { LeaderboardView,ProfileView } from './views';
import LoginView from './LoginView.vue';
import HomeView from './HomeView.vue';
import WorkspaceView from './WorkspaceView.vue';
import ChallengesView from './ChallengesView.vue';
import RangeView from './RangeView.vue';
import AttackView from './AttackView.vue';
import SkillView from './SkillView.vue';
import LearningView from './LearningView.vue';
export default createRouter({history:createWebHistory(),routes:[{path:'/',component:HomeView},{path:'/login',component:LoginView},{path:'/challenges',component:ChallengesView},{path:'/challenges/:id',component:WorkspaceView,props:true},{path:'/range',component:RangeView},{path:'/attack-map',component:AttackView},{path:'/skills',component:SkillView},{path:'/learning',component:LearningView},{path:'/leaderboard',component:LeaderboardView},{path:'/profile',component:ProfileView}]})
