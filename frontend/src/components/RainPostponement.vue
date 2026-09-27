<template>
  <div>
    <!-- 原场次已改期：结论 + 新场次入口 -->
    <div v-if="screening.status === 'postponed'" class="notice" style="background:#e1f4fe;border-color:#0277bd">
      🌧️ 本场次已因强降雨改期，<b>原场次不进入正常核销</b>。
      <span v-if="p">新场次：
        <router-link v-if="p.newScreeningId" :to="`/screenings/${p.newScreeningId}`" style="font-weight:700">
          {{ p.newShowDate }} {{ p.newShowTime }}（{{ p.newScreeningId.slice(0,8) }}…）→
        </router-link>
        主办方后续申请评分已{{ p.creditDelta > 0 ? `扣减 ${p.creditDelta} 分` : '按无责处理（不扣分）' }}。
      </span>
    </div>

    <!-- 改期确认后（理论上原场次已 postponed，这里兜底展示结果） -->
    <div v-if="p && p.status === 'confirmed'" class="card">
      <h3>改期处理结论</h3>
      <div class="grid4">
        <div class="kpi"><div class="num">{{ p.copyrightReusable ? '沿用' : '需重核' }}</div><div class="label">版权授权</div></div>
        <div class="kpi"><div class="num">{{ p.equipmentReusable ? '随套沿用' : '撤场回库' }}</div><div class="label">设备占用</div></div>
        <div class="kpi"><div class="num">{{ p.securityReusable ? '排班顺延' : '重新排班' }}</div><div class="label">安保排班</div></div>
        <div class="kpi"><div class="num">{{ p.subsidyEligible ? '保留' : '取消' }}</div><div class="label">补贴资格</div></div>
      </div>
      <div class="grid4" style="margin-top:10px">
        <div class="kpi"><div class="num">¥{{ fen(p.coOrganizerFeePaid) }}</div><div class="label">已缴协办费</div></div>
        <div class="kpi"><div class="num">¥{{ fen(p.refundableAmount) }}</div><div class="label">可退费用</div></div>
        <div class="kpi"><div class="num">¥{{ fen(p.setupCost) }}</div><div class="label">已发生搭建成本</div></div>
        <div class="kpi"><div class="num">¥{{ fen(p.audienceCompensation) }}</div><div class="label">观众补偿</div></div>
      </div>
    </div>

    <!-- 可发起改期：现场搭建完成/放映中且未改期 -->
    <template v-if="screening.status !== 'postponed'">
      <div v-if="!p || p.status !== 'confirmed'" class="card">
        <h3>① 现场负责人上传强降雨改期材料</h3>
        <div class="notice">
          现场搭建完成后遇强降雨，由现场负责人上传四项材料：
          <b>气象预警/降雨截图、已到场设备清点、观众通知、商户协调结果</b>。材料齐备后进入四方沿用评估。
        </div>
        <div v-if="canSubmit" class="grid2">
          <div class="form-row"><label>拟定改期日期</label>
            <input v-model="mat.newShowDate" type="date" />
          </div>
          <div class="form-row"><label>拟定改期时间</label>
            <input v-model="mat.newShowTime" type="time" />
          </div>
          <div class="form-row"><label class="req">气象截图</label>
            <input v-model="mat.weatherShotUrl" placeholder="气象预警/强降雨截图文件名或 URL" />
          </div>
          <div class="form-row"><label>气象说明</label>
            <input v-model="mat.weatherNote" placeholder="如：气象台暴雨橙色预警 19:00-23:00" />
          </div>
        </div>
        <div v-if="canSubmit">
          <div class="form-row" style="grid-template-columns:130px 1fr"><label class="req">已到场设备</label>
            <textarea v-model="mat.equipmentOnSite" placeholder="已到场设备清点，如：投影/幕布/2只音箱/电缆盘已搭建，备用灯泡与防雨罩在场" />
          </div>
          <div class="form-row" style="grid-template-columns:130px 1fr"><label class="req">观众通知</label>
            <textarea v-model="mat.audienceNotice" placeholder="观众通知方式与改期/退票/补偿口径，如：现场广播+社群公告，凭原通知改期入场" />
          </div>
          <div class="form-row" style="grid-template-columns:130px 1fr"><label class="req">商户协调结果</label>
            <textarea v-model="mat.merchantCoord" placeholder="与周边商户协调结果：外摆延长、撤场、已缴协办费金额等" />
          </div>
          <div class="row" style="padding-left:140px">
            <button class="primary" @click="submitMaterials">保存/提交改期材料</button>
            <span v-if="p" class="tag" :class="statusClass(p.status)">{{ POSTPONE_STATUS_LABEL[p.status] }}</span>
          </div>
        </div>
        <div v-else class="muted">仅设备到场、现场搭建确认后或放映中，可由现场负责人发起改期。</div>

        <table v-if="p" class="list" style="margin-top:12px">
          <tbody>
            <tr><td style="width:150px">气象截图/说明</td><td>{{ p.weatherShotUrl || '—' }} <span class="muted">{{ p.weatherNote }}</span></td></tr>
            <tr><td>已到场设备</td><td>{{ p.equipmentOnSite || '—' }}</td></tr>
            <tr><td>观众通知</td><td>{{ p.audienceNotice || '—' }}</td></tr>
            <tr><td>商户协调结果</td><td>{{ p.merchantCoord || '—' }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 四方沿用评估 -->
      <div v-if="p && canEvaluate" class="card">
        <h3>② 平台四方判断能否沿用</h3>
        <div class="notice">
          审核员核版权授权日期、仓库核设备占用、安保核排班、财务核补贴资格；四方结论全部给出后进入财务拆费。
        </div>
        <table class="list">
          <thead><tr><th>评估项</th><th>责任角色</th><th>结论</th><th>意见</th><th v-if="canEvaluate">操作</th></tr></thead>
          <tbody>
            <tr v-for="d in dims" :key="d.key">
              <td><b>{{ d.label }}</b></td>
              <td>{{ d.roleLabel }}</td>
              <td>
                <span v-if="value(d.key) !== null" class="tag" :class="value(d.key) ? 'green' : 'red'">
                  {{ value(d.key) ? '可沿用' : '不可沿用' }}
                </span>
                <span v-else class="muted">待评估</span>
              </td>
              <td class="muted">{{ note(d.key) || '—' }}</td>
              <td v-if="canEvaluate">
                <template v-if="isDimRole(d.role)">
                  <input v-model="evalDraft[d.key].note" placeholder="意见" style="width:180px;margin-right:6px" />
                  <button class="success" @click="evaluate(d.key, true)">可沿用</button>
                  <button class="danger" @click="evaluate(d.key, false)">不可沿用</button>
                </template>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 财务拆分协办费 + 观众补偿 -->
      <div v-if="p && canFinance" class="card">
        <h3>③ 商户已缴协办费拆分与观众补偿（财务）</h3>
        <div class="notice">
          若商户已缴协办费，区分<b>可退费用</b>与<b>已发生搭建成本（不退）</b>；
          另有观众补偿的须先完成补偿通知触达。可退费用＋搭建成本不超过已缴总额。
        </div>
        <div class="grid4">
          <div class="form-row"><label>已缴协办费(元)</label><input v-model.number="fee.coOrganizerFeePaidYuan" type="number" min="0" /></div>
          <div class="form-row"><label>可退费用(元)</label><input v-model.number="fee.refundableYuan" type="number" min="0" /></div>
          <div class="form-row"><label>搭建成本(元)</label><input v-model.number="fee.setupCostYuan" type="number" min="0" /></div>
          <div class="form-row"><label>观众补偿(元)</label><input v-model.number="fee.audienceYuan" type="number" min="0" /></div>
        </div>
        <div class="form-row" style="grid-template-columns:130px 1fr;margin-top:8px"><label>费用说明</label>
          <input v-model="fee.feeNote" placeholder="退费/搭建成本口径说明" />
        </div>
        <div class="row" style="padding-left:140px;margin-top:8px">
          <label class="muted"><input type="checkbox" v-model="fee.audienceCompNotified" style="width:auto" /> 观众补偿通知已触达</label>
          <button class="primary" @click="splitFee">保存费用拆分</button>
          <span v-if="Number(fee.coOrganizerFeePaidYuan)>0" class="muted">
            校验：可退+搭建 ¥{{ Number(fee.refundableYuan||0)+Number(fee.setupCostYuan||0) }} / 已缴 ¥{{ fee.coOrganizerFeePaidYuan }}
          </span>
        </div>
      </div>

      <!-- 确认改期 -->
      <div v-if="p && canConfirm" class="card">
        <h3>④ 确认改期并生成新场次</h3>
        <div class="grid2">
          <div class="form-row"><label class="req">改期放映日期</label><input v-model="confirmForm.newShowDate" type="date" /></div>
          <div class="form-row"><label>改期时间</label><input v-model="confirmForm.newShowTime" type="time" /></div>
        </div>
        <div class="form-row" style="grid-template-columns:150px 1fr">
          <label>主办方信用扣减</label>
          <input v-model.number="confirmForm.creditPenalty" type="number" min="0" max="20" style="width:120px" />
          <span class="muted">分（默认 3 分，影响该主办方后续申请评分；确属不可抗力可填 0）</span>
        </div>
        <div class="form-row" style="grid-template-columns:150px 1fr"><label>备注</label>
          <input v-model="confirmForm.remark" placeholder="改期说明" />
        </div>
        <div class="row" style="padding-left:160px">
          <button class="success" @click="confirmPostpone">✓ 确认改期（原场次不核销，克隆新场次）</button>
        </div>
        <div v-if="!allEvaluated" class="notice danger" style="margin-top:10px">四方沿用评估尚未全部完成，暂不能确认。</div>
        <div v-else-if="Number(p.audienceCompensation)>0 && !p.audienceCompNotified" class="notice danger" style="margin-top:10px">
          存在观众补偿但补偿通知尚未触达。
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  api, currentUser, POSTPONE_STATUS_LABEL, RAIN_DIMENSIONS, fenToYuan,
} from '../api';

const props = defineProps<{ screening: any }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const user = computed(() => currentUser());
const fen = fenToYuan;
const dims = RAIN_DIMENSIONS;
const p = ref<any>(null);

const isAny = (...rs: string[]) => rs.includes(user.value?.role || '');

const canSubmit = computed(() =>
  isAny('site_manager', 'street') &&
  ['equipment_checked_out', 'site_confirmed', 'screening'].includes(props.screening?.status));
const canEvaluate = computed(() =>
  p.value && ['evaluating', 'fee_pending'].includes(p.value.status) &&
  isAny('reviewer', 'warehouse', 'security', 'finance', 'street'));
const canFinance = computed(() =>
  p.value && ['evaluating', 'fee_pending'].includes(p.value.status) &&
  ['copyrightReusable', 'equipmentReusable', 'securityReusable', 'subsidyEligible']
    .every((k) => p.value[k] !== null) &&
  isAny('finance', 'street'));
const canConfirm = computed(() =>
  p.value && ['evaluating', 'fee_pending'].includes(p.value.status) && isAny('street', 'finance'));
const allEvaluated = computed(() => p.value &&
  ['copyrightReusable', 'equipmentReusable', 'securityReusable', 'subsidyEligible'].every((k) => p.value[k] !== null));

const mat = reactive({
  newShowDate: '', newShowTime: '', weatherShotUrl: '', weatherNote: '',
  equipmentOnSite: '', audienceNotice: '', merchantCoord: '',
});
const evalDraft = reactive<Record<string, any>>({});
const fee = reactive({
  coOrganizerFeePaidYuan: 0, refundableYuan: 0, setupCostYuan: 0,
  audienceYuan: 0, feeNote: '', audienceCompNotified: false,
});
const confirmForm = reactive({ newShowDate: '', newShowTime: '19:30', creditPenalty: 3, remark: '' });

function value(key: string) { return p.value ? p.value[`${key}Reusable`] ?? p.value[`${key}Eligible`] : null; }
function note(key: string) { return p.value ? p.value[`${key}Note`] : null; }
function isDimRole(role: string) { return user.value?.role === role || user.value?.role === 'street'; }
function statusClass(st: string) {
  return ({ draft: 'orange', evaluating: 'blue', fee_pending: 'orange', confirmed: 'green' } as any)[st] || 'gray';
}

async function load() {
  const { data } = await api.get(`/screenings/${props.screening.id}/postponement`);
  p.value = data;
  if (data) {
    mat.newShowDate = data.newShowDate || '';
    mat.newShowTime = data.newShowTime || '';
    mat.weatherShotUrl = data.weatherShotUrl || '';
    mat.weatherNote = data.weatherNote || '';
    mat.equipmentOnSite = data.equipmentOnSite || '';
    mat.audienceNotice = data.audienceNotice || '';
    mat.merchantCoord = data.merchantCoord || '';
    fee.coOrganizerFeePaidYuan = Number(data.coOrganizerFeePaid) / 100;
    fee.refundableYuan = Number(data.refundableAmount) / 100;
    fee.setupCostYuan = Number(data.setupCost) / 100;
    fee.audienceYuan = Number(data.audienceCompensation) / 100;
    fee.feeNote = data.feeNote || '';
    fee.audienceCompNotified = !!data.audienceCompNotified;
    confirmForm.newShowDate = data.newShowDate || '';
    confirmForm.newShowTime = data.newShowTime || '19:30';
    confirmForm.creditPenalty = data.creditDelta || 3;
    for (const d of dims) if (!evalDraft[d.key]) evalDraft[d.key] = { note: data[`${d.key}Note`] || '' };
  }
}

async function submitMaterials() {
  await api.post(`/screenings/${props.screening.id}/postponement`, { ...mat });
  await load();
  emit('changed');
}
async function evaluate(key: string, reusable: boolean) {
  await api.post(`/screenings/${props.screening.id}/postponement/evaluate`, {
    dimension: key, reusable, note: evalDraft[key]?.note || undefined,
  });
  await load();
  emit('changed');
}
async function splitFee() {
  await api.post(`/screenings/${props.screening.id}/postponement/fee`, {
    coOrganizerFeePaid: Math.round(Number(fee.coOrganizerFeePaidYuan || 0) * 100),
    refundableAmount: Math.round(Number(fee.refundableYuan || 0) * 100),
    setupCost: Math.round(Number(fee.setupCostYuan || 0) * 100),
    audienceCompensation: Math.round(Number(fee.audienceYuan || 0) * 100),
    feeNote: fee.feeNote || undefined,
    audienceCompNotified: fee.audienceCompNotified,
  });
  await load();
  emit('changed');
}
async function confirmPostpone() {
  await api.post(`/screenings/${props.screening.id}/postponement/confirm`, {
    newShowDate: confirmForm.newShowDate,
    newShowTime: confirmForm.newShowTime || undefined,
    creditPenalty: Number(confirmForm.creditPenalty || 0),
    remark: confirmForm.remark || undefined,
  });
  await load();
  emit('changed');
}

watch(() => props.screening?.id, load);
onMounted(load);
</script>
