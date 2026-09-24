<template>
  <div>
    <h2 style="font-size:20px">设备库存与成套</h2>
    <div class="card">
      <h3>成套视图（一套六件：投影机/幕布/音箱/电缆/备用灯泡/防雨罩）</h3>
      <div class="grid3">
        <div v-for="k in kits" :key="k.kitNo" class="kit">
          <div class="row" style="justify-content:space-between">
            <b>{{ k.kitNo }}</b>
            <span class="tag" :class="k.allInStock && k.complete ? 'green' : 'orange'">
              {{ k.complete ? (k.allInStock ? '整套在库' : '部分在外') : '不完整' }}
            </span>
          </div>
          <div style="margin-top:8px">
            <span v-for="i in k.items" :key="i.id" class="pill" :class="{ dim: i.status !== 'in_stock' }">
              {{ EQUIPMENT_TYPES[i.type] }}
              <template v-if="i.status !== 'in_stock'">（{{ equipStatus[i.status] }}）</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>全部资产</h3>
      <div class="row" style="margin-bottom:10px">
        <select v-model="f.type" @change="load" style="width:140px">
          <option value="">全部类型</option>
          <option v-for="(label,key) in EQUIPMENT_TYPES" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="f.status" @change="load" style="width:140px">
          <option value="">全部状态</option>
          <option v-for="(label,key) in equipStatus" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <table class="list">
        <thead><tr><th>资产编码</th><th>名称</th><th>类型</th><th>套号</th><th>状态</th><th>成色</th><th>备注</th></tr></thead>
        <tbody>
          <tr v-for="e in items" :key="e.id">
            <td><b>{{ e.code }}</b></td><td>{{ e.name }}</td>
            <td>{{ EQUIPMENT_TYPES[e.type] }}</td><td>{{ e.kitNo }}</td>
            <td><span class="tag" :class="statusClass(e.status)">{{ equipStatus[e.status] }}</span></td>
            <td>{{ e.condition }}%</td><td class="muted">{{ e.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, EQUIPMENT_TYPES } from '../api';

const items = ref<any[]>([]);
const kits = ref<any[]>([]);
const f = reactive({ type: '', status: '' });
const equipStatus: Record<string, string> = {
  in_stock: '在库', prepared: '已备料', checked_out: '已出库', returned: '已归还', damaged: '损坏', lost: '遗失',
};
function statusClass(st: string) {
  return ({ in_stock: 'green', prepared: 'orange', checked_out: 'blue', damaged: 'red', lost: 'gray' } as any)[st] || 'gray';
}
async function load() {
  const { data } = await api.get('/equipment', { params: { type: f.type || undefined, status: f.status || undefined } });
  items.value = data;
  const k = await api.get('/equipment/kits');
  kits.value = k.data;
}
onMounted(load);
</script>
<style scoped>
.kit { border: 1px solid var(--border); border-radius: 10px; padding: 14px; background: #fbfcfe; }
.pill.dim { background: #fdecea; color: #a93226; }
</style>
