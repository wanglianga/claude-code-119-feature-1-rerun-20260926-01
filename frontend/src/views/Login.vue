<template>
  <div class="login-page">
    <div class="login-box">
      <div class="brand">🎬 城市露天电影</div>
      <h2>放映审批与设备巡检平台</h2>
      <p class="muted">社区 · 物业 · 商圈 · 文化审核 · 仓库 · 现场 · 安保 · 财务 · 街道</p>
      <div class="form-row" style="grid-template-columns: 1fr;">
        <input v-model="username" placeholder="用户名" @keyup.enter="login" />
      </div>
      <div class="form-row" style="grid-template-columns: 1fr;">
        <input v-model="password" type="password" placeholder="密码" @keyup.enter="login" />
      </div>
      <button class="primary" style="width:100%;padding:11px" :disabled="loading" @click="login">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
      <div class="demo">
        <div class="muted" style="margin:12px 0 6px">演示账号（密码均为 123456，点击快速填充）：</div>
        <div class="accounts">
          <span v-for="a in accounts" :key="a.u" class="acct" @click="fill(a.u)">
            <b>{{ a.u }}</b> · {{ a.label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setSession } from '../api';

const router = useRouter();
const username = ref('applicant');
const password = ref('123456');
const loading = ref(false);

const accounts = [
  { u: 'applicant', label: '申请方（社区）' },
  { u: 'applicant2', label: '申请方（商圈）' },
  { u: 'reviewer', label: '文化审核员' },
  { u: 'warehouse', label: '仓库管理员' },
  { u: 'site', label: '现场负责人' },
  { u: 'security', label: '安保' },
  { u: 'finance', label: '财务' },
  { u: 'street', label: '街道文体岗' },
];
function fill(u: string) { username.value = u; password.value = '123456'; }

async function login() {
  loading.value = true;
  try {
    const { data } = await api.post('/auth/login', { username: username.value, password: password.value });
    setSession(data.token, data.user);
    router.push('/screenings');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #16345f 0%, #1f5fbf 60%, #3b82d9 100%);
  padding: 20px;
}
.login-box {
  background: #fff; border-radius: 14px; padding: 34px 36px;
  width: 480px; max-width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
}
.brand { font-size: 22px; }
.login-box h2 { margin: 8px 0 6px; font-size: 20px; }
.accounts { display: flex; flex-wrap: wrap; gap: 6px; }
.acct {
  font-size: 12px; background: #f1f5fb; border: 1px solid #e3e8f0;
  border-radius: 6px; padding: 4px 9px; cursor: pointer; color: #374151;
}
.acct:hover { background: #e3edfb; }
</style>
