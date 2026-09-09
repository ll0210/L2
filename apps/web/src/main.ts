import { createApp } from 'vue'; import { createPinia } from 'pinia'; import App from './App.vue'; import router from './router'; import { useAuth } from './stores/auth'; import { connectRealtime } from './realtime'; import './styles.css'; import './login.css'; import './catalog.css'; import './polish.css'; import './experience.css'; import './home.css'; import './workspace-editorial.css'; import './workspace-workbench.css';
const pinia = createPinia();
createApp(App).use(pinia).use(router).mount('#app');
const auth = useAuth(pinia);
if (auth.token) connectRealtime(auth.token);
