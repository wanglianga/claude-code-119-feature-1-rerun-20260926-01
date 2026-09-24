<template>
  <div>
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <h2 style="margin:0;font-size:20px">放映场次</h2>
      <div class="row">
        <select v-model="statusFilter" @change="load" style="width:180px">
          <option value="">全部状态</option>
          <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
        <button v-if="canApply" class="primary" @click="$router.push('/screenings/new')">➕ 新建申请</button>
      </div>
    </div>

    <div class="card">
      <table class="list">
        <thead>
          <tr>
            <th>场次编号</th><th>影片/活动</th><th>放映时间</th><th>场地</th><th>主办方</th>
            <th>预计观众</th><th>状态</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in list" :key="s.id">
            <td><b>{{ s.code }}</b></td>
            <td>《{{ s.filmName }}》<div class="muted">{{ s.title }}</div></td>
            <td>{{ s.showDate }}<br><span class="muted">{{ s.showTime }}</span></td>
            <td>{{ s.venue?.name }}<div v-if="s.venue?.blacklisted" class="tag red" style="margin-top:3px">黑名单</div></td>
            <td>{{ s.organizer?.name }}</td>
            <td>{{ s.expectedAudience }}</td>
            <td><span class="tag" :style="{ background: STATUS_COLOR[s.status] }">{{ s.statusLabel }}</span></td>
            <td><button @click="$router.push(`/screenings/${s.id}`)">进入处理</button></td>
          </tr>
          <tr v-if="!list.length"><td colspan="8" class="muted" style="text-align:center;padding:26px">暂无场次</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, currentUser, STATUS_COLOR, STATUS_LABEL } from '../api';

const list = ref<any[]>([]);
const statusFilter = ref('');
const user = computed(() => currentUser());
const canApply = computed(() => ['applicant', 'street'].includes(user.value?.role || ''));

async function load() {
  const { data } = await api.get('/screenings', { params: { status: statusFilter.value || undefined } });
  list.value = data;
}
onMounted(load);
</script>
