<template>
  <div>
    <h2 style="font-size:20px">主办方信用记录与设备押金</h2>
    <div class="notice">
      社区、物业、商圈运营方等主办方独立建档：投诉、超员、设备损坏等核实后扣减信用分并影响押金；
      信用过低将限制下一轮申请。
    </div>
    <div class="card">
      <table class="list">
        <thead>
          <tr><th>主办方</th><th>类型</th><th>联系人</th><th>累计场次</th>
            <th>违规次数</th><th>雨天改期</th><th>信用分</th><th>押金余额</th><th>备注</th>
            <th v-if="canEdit">信用调整</th></tr>
        </thead>
        <tbody>
          <tr v-for="o in list" :key="o.id">
            <td><b>{{ o.name }}</b></td>
            <td>{{ o.organizerType }}</td>
            <td>{{ o.contactName }}<br><span class="muted">{{ o.contactPhone }}</span></td>
            <td>{{ o.totalScreenings }}</td>
            <td :class="{ hot: o.violationCount >= 3 }">{{ o.violationCount }}</td>
            <td :class="{ hot: (o.rescheduleCount||0) >= 2 }">{{ o.rescheduleCount || 0 }}</td>
            <td>
              <div class="credit-bar"><div :style="{ width: o.creditScore + '%', background: creditColor(o.creditScore) }" /></div>
              <b>{{ o.creditScore }}</b>
              <span class="muted"> / 100</span>
            </td>
            <td>¥{{ (Number(o.depositBalance) / 100).toFixed(2) }}</td>
            <td class="muted" style="max-width:220px">{{ o.remark }}</td>
            <td v-if="canEdit">
              <div class="row">
                <input v-model="drafts[o.id].delta" type="number" placeholder="±分值" style="width:80px" />
                <input v-model="drafts[o.id].remark" placeholder="原因" style="width:120px" />
                <button @click="adjust(o.id)">应用</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, currentUser } from '../api';

const list = ref<any[]>([]);
const drafts = reactive<Record<string, any>>({});
const canEdit = computed(() => ['street', 'finance'].includes(currentUser()?.role || ''));
function creditColor(score: number) {
  return score >= 90 ? '#2e7d32' : score >= 75 ? '#e6a23c' : '#d9534f';
}
async function load() {
  const { data } = await api.get('/organizers');
  list.value = data;
  for (const o of data) if (!drafts[o.id]) drafts[o.id] = { delta: -5, remark: '' };
}
async function adjust(id: string) {
  const d = drafts[id];
  if (!d.delta) return;
  await api.post(`/organizers/${id}/violation`, { scoreDelta: Number(d.delta), remark: d.remark || '街道信用调整' });
  d.remark = '';
  await load();
}
onMounted(load);
</script>
<style scoped>
.hot { color: #d9534f; font-weight: 700; }
.credit-bar { width: 150px; height: 8px; background: #edf0f5; border-radius: 4px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px; }
.credit-bar div { height: 100%; }
</style>
