<template>
  <div>
    <h2 style="font-size:20px">异常协同工单</h2>
    <div class="notice">
      覆盖七类突发：影片文件损坏、设备缺件、居民投诉噪声、临时降雨、观众超员、供电跳闸、商户要求延长。
      六类角色围绕同一工单留言；办结确认成立的噪声/损坏/超员自动计入点位风险与主办方信用。
    </div>

    <div class="layout2">
      <div class="card" style="margin:0">
        <div class="row" style="margin-bottom:10px">
          <select v-model="statusFilter" @change="loadList" style="width:130px">
            <option value="">全部状态</option>
            <option value="open">待处理</option>
            <option value="handling">处理中</option>
            <option value="resolved">已办结</option>
          </select>
          <span class="muted">共 {{ list.length }} 单</span>
        </div>
        <table class="list">
          <thead><tr><th>类型</th><th>发起人</th><th>主责</th><th>状态</th><th>分贝</th><th>时间</th></tr></thead>
          <tbody>
            <tr v-for="i in list" :key="i.id" :class="{ active: focusId === i.id }" @click="open(i.id)" style="cursor:pointer">
              <td><b>{{ INCIDENT_TYPES[i.type] || i.title }}</b><div class="muted">{{ i.description.slice(0, 28) }}…</div></td>
              <td>{{ i.createdBy?.name }}</td>
              <td><span class="pill">{{ ROLE_NAME[i.ownerRole] || i.ownerRole }}</span></td>
              <td><span class="tag" :class="i.status === 'resolved' ? 'green' : i.status === 'handling' ? 'orange' : 'red'">
                {{ i.status === 'resolved' ? '已办结' : i.status === 'handling' ? '处理中' : '待处理' }}
              </span></td>
              <td>{{ i.noiseDb ?? '—' }}</td>
              <td class="muted">{{ fmt(i.createdAt) }}</td>
            </tr>
            <tr v-if="!list.length"><td colspan="6" class="muted" style="text-align:center;padding:24px">暂无工单</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="detail" class="card" style="margin:0">
        <div class="row" style="justify-content:space-between">
          <h3 style="margin:0">{{ INCIDENT_TYPES[detail.type] || detail.title }}</h3>
          <router-link :to="`/screenings/${detail.screening?.id}`">场次 {{ detail.screening?.code }} →</router-link>
        </div>
        <div class="muted" style="margin:8px 0">{{ detail.description }}</div>
        <div class="row" style="margin-bottom:12px">
          <span class="pill">主责：{{ ROLE_NAME[detail.ownerRole] || detail.ownerRole }}</span>
          <span v-if="detail.noiseDb" class="pill">实测 {{ detail.noiseDb }} dB</span>
          <span class="pill">发起人：{{ detail.createdBy?.name }}</span>
        </div>

        <div class="timeline2">
          <div v-for="r in detail.replies" :key="r.id" class="reply">
            <div class="who">
              <b>{{ r.user?.name }}</b>
              <span class="pill">{{ ROLE_NAME[r.user?.role] || r.user?.role }}</span>
              <span class="muted">{{ fmt(r.createdAt) }}</span>
            </div>
            <div>{{ r.content }}</div>
          </div>
        </div>

        <template v-if="detail.status !== 'resolved'">
          <textarea v-model="replyText" placeholder="以当前角色身份留言协同（仓库补货/审核换片授权/安保疏导/财务定赔等）" />
          <div class="row" style="margin-top:10px">
            <button @click="sendReply">留言协同</button>
            <button class="primary" @click="sendReply('handling')">接单并转为处理中</button>
            <input v-model="resolveText" placeholder="办结结论（必填后点右侧）" style="flex:1;min-width:180px" />
            <label class="muted"><input type="checkbox" style="width:auto" v-model="confirmed" /> 情况属实，计入风险/信用</label>
            <button class="success" @click="resolve">办结工单</button>
          </div>
        </template>
        <div v-else class="notice success" style="margin-top:12px">
          已办结：{{ detail.resolution }}（{{ fmt(detail.resolvedAt) }}）
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, INCIDENT_TYPES, ROLE_NAME } from '../api';

const route = useRoute();
const list = ref<any[]>([]);
const detail = ref<any>(null);
const focusId = ref('');
const statusFilter = ref('');
const replyText = ref('');
const resolveText = ref('');
const confirmed = ref(true);

function fmt(d?: string) { return d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—'; }

async function loadList() {
  const { data } = await api.get('/incidents', { params: { status: statusFilter.value || undefined } });
  list.value = data;
  if (focusId.value) await open(focusId.value);
}
async function open(id: string) {
  focusId.value = id;
  const { data } = await api.get(`/incidents/${id}`);
  detail.value = data;
}
async function sendReply(status?: string) {
  if (!replyText.value.trim()) return;
  const { data } = await api.post(`/incidents/${detail.value.id}/replies`, { content: replyText.value, status });
  detail.value = data;
  replyText.value = '';
  await loadList();
}
async function resolve() {
  if (!resolveText.value.trim()) return;
  const { data } = await api.post(`/incidents/${detail.value.id}/resolve`, {
    resolution: resolveText.value, confirmed: confirmed.value,
  });
  detail.value = data;
  resolveText.value = '';
  await loadList();
}

watch(() => route.query.focus, (v) => { if (v) open(String(v)); });
onMounted(async () => {
  await loadList();
  if (route.query.focus) await open(String(route.query.focus));
});
</script>
<style scoped>
.layout2 { display: grid; grid-template-columns: 430px 1fr; gap: 16px; align-items: start; }
tr.active td { background: #eaf1fc !important; }
.timeline2 { max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; background: #fbfcfe; }
.reply { padding: 8px 0; border-bottom: 1px dashed var(--border); }
.reply:last-child { border-bottom: none; }
.who { display: flex; gap: 8px; align-items: center; margin-bottom: 3px; font-size: 13px; }
</style>
