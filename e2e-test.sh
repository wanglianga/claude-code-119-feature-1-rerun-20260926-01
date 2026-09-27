#!/usr/bin/env bash
# 端到端业务流验证：申请→黑名单拦截→审批→成套备料→扫码（错误码拒绝+六件齐出库）
# →五项现场上传→确认→开始放映→志愿者→噪声投诉多角色协同办结（风险/信用联动）
# →归还定损→版权核销→财务流水→关单→街道看板
set -u
BASE="${BASE:-http://localhost:3119/api}"
PASS=0; FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
check(){ if eval "$2"; then ok "$1"; else bad "$1 ($3)"; fi; }

login(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$1\",\"password\":\"123456\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }

req(){ local method=$1 token=$2 path=$3; shift 3;
  curl -s -X "$method" "$BASE$path" -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' "$@"; }

echo "== 0. 健康检查 =="
H=$(curl -s "$BASE/health")
echo "  $H"
echo "$H" | grep -q '"status":"ok"' && ok "health ok" || bad "health"

echo "== 1. 八类角色登录 =="
for u in applicant applicant2 reviewer warehouse site security finance street; do
  T=$(login $u)
  [ "${#T}" -gt 40 ] && ok "$u 登录" || bad "$u 登录"
  eval "TOK_$u=$T"
done

echo "== 2. 申请方：黑名单场地拦截 =="
BLACK=$(req GET "$TOK_street" /venues | python3 -c 'import sys,json;print(next(v["id"] for v in json.load(sys.stdin) if v["blacklisted"]))')
ORG=$(req GET "$TOK_applicant" /organizers | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
BODY="{\"title\":\"黑名单测试\",\"organizerId\":\"$ORG\",\"venueId\":\"$BLACK\",\"showDate\":\"2026-10-01\",\"showTime\":\"19:30\",\"location\":\"中庭\",\"expectedAudience\":100,\"filmName\":\"测试片\",\"copyrightProof\":\"P-1\",\"copyrightOwner\":\"版权方\",\"powerCondition\":\"市电\",\"screenSize\":\"3x2\",\"speakerCount\":1,\"securityStaff\":2,\"rainPlan\":\"无\"}"
R=$(req POST "$TOK_applicant" /screenings -d "$BODY")
echo "$R" | grep -q '黑名单' && ok "黑名单场地申请被拦截" || bad "黑名单拦截: $R"

echo "== 3. 申请方新建申请并提交 → 审核员审批 =="
VENUE_OK=$(req GET "$TOK_street" /venues | python3 -c 'import sys,json;print(next(v["id"] for v in json.load(sys.stdin) if not v["blacklisted"]))')
BODY="{\"title\":\"端到端验证专场\",\"organizerId\":\"$ORG\",\"venueId\":\"$VENUE_OK\",\"showDate\":\"2026-10-05\",\"showTime\":\"19:30\",\"location\":\"广场北侧\",\"expectedAudience\":220,\"filmName\":\"我和我的祖国\",\"copyrightProof\":\"ZS-E2E-0001\",\"copyrightOwner\":\"中影\",\"powerCondition\":\"市政配电箱220V/16A 40米\",\"screenSize\":\"6m x 3.4m\",\"speakerCount\":2,\"securityStaff\":4,\"rainPlan\":\"防雨罩+转多功能厅\",\"siteManagerName\":\"周强\",\"securityLeadName\":\"孙队\"}"
SID=$(req POST "$TOK_applicant" /screenings -d "$BODY" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
[ -n "$SID" ] && ok "申请创建 $SID" || bad "申请创建"
R=$(req POST "$TOK_applicant" "/screenings/$SID/submit" -d '{}')
echo "$R" | grep -q 'pending_review' && ok "提交送审→pending_review" || bad "送审: $R"
R=$(req POST "$TOK_reviewer" "/screenings/$SID/review" -d '{"approved":true,"filingNo":"BA-E2E-001","comment":"端到端验证：授权与备案通过"}')
echo "$R" | grep -q 'review_approved' && ok "审核通过" || bad "审核: $R"
echo "== 4. 仓库成套备料 =="
R=$(req POST "$TOK_warehouse" "/equipment/screening/$SID/prepare" -d '{}')
echo "$R" | grep -q 'equipment_prepared' && ok "备料完成、状态→equipment_prepared" || bad "备料: $R"
ASSIGN=$(req GET "$TOK_warehouse" "/equipment/screening/$SID/assignments")
COUNT=$(echo "$ASSIGN" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$COUNT" = "6" ] && ok "成套6件 ($COUNT)" || bad "成套件数=$COUNT"

echo "== 5. 扫码核对：错误编码先拒绝，六件正确编码出库 =="
WRONG=$(echo "$ASSIGN" | python3 -c 'import sys,json;a=json.load(sys.stdin);print(a[0]["equipment"]["code"][:-2]+"00")')
R=$(req POST "$TOK_warehouse" "/equipment/screening/$SID/scan" -d "{\"code\":\"$WRONG\"}")
echo "$R" | grep -q '扫码失败' && ok "不存在编码拒绝" || bad "错误编码: $R"
# 取另一场次无关设备编码（KIT-02 的一件）——先备第二场会占用，这里直接用库存接口找未分配的
OTHER=$(req GET "$TOK_warehouse" '/equipment?status=in_stock' | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["code"])')
R=$(req POST "$TOK_warehouse" "/equipment/screening/$SID/scan" -d "{\"code\":\"$OTHER\"}")
echo "$R" | grep -q '不属于本场次' && ok "非本场成套编码拒绝" || bad "非成套拒绝: $R"
for CODE in $(echo "$ASSIGN" | python3 -c 'import sys,json;[print(x["equipment"]["code"]) for x in json.load(sys.stdin)]'); do
  req POST "$TOK_warehouse" "/equipment/screening/$SID/scan" -d "{\"code\":\"$CODE\"}" >/dev/null
done
S=$(req GET "$TOK_warehouse" "/screenings/$SID")
echo "$S" | grep -q 'equipment_checked_out' && ok "六件齐→自动出库" || bad "出库状态: $(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')"

echo "== 6. 现场五项上报（含噪声68dB首次不合格）+ 缺项拒绝确认 =="
req POST "$TOK_site" "/screenings/$SID/inspections" -d '{"category":"build_setup","detail":"银幕与投影搭建完成"}' >/dev/null
req POST "$TOK_site" "/screenings/$SID/inspections" -d '{"category":"test_play","detail":"试播10分钟画面声音正常"}' >/dev/null
N1=$(req POST "$TOK_security" "/screenings/$SID/inspections" -d '{"category":"noise","noiseDb":68,"detail":"开场前试音偏大"}')
echo "$N1" | grep -q '"passed":false' && ok "68dB 自动判不合格" || bad "噪声判定: $N1"
req POST "$TOK_security" "/screenings/$SID/inspections" -d '{"category":"noise","noiseDb":56,"detail":"调小音量后复测"}' >/dev/null
req POST "$TOK_security" "/screenings/$SID/inspections" -d '{"category":"isolation","detail":"观众区护栏隔离完成"}' >/dev/null
R=$(req POST "$TOK_site" "/screenings/$SID/confirm-site" -d '{}')
echo "$R" | grep -q '消防通道' && ok "五项缺消防通道时拒绝确认" || bad "缺项拦截: $R"
req POST "$TOK_security" "/screenings/$SID/inspections" -d '{"category":"firelane","detail":"消防通道4米畅通"}' >/dev/null
R=$(req POST "$TOK_site" "/screenings/$SID/confirm-site" -d '{}')
echo "$R" | grep -q 'site_confirmed' && ok "五项齐→现场确认" || bad "现场确认: $R"

echo "== 7. 志愿者签到/签退 + 开始放映 =="
R=$(req POST "$TOK_site" "/screenings/$SID/volunteers" -d '{"volunteerName":"志愿小张","phone":"13900001111","duty":"秩序维护"}')
VID=$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
req POST "$TOK_site" "/screenings/$SID/volunteers/$VID/checkout" -d '{}' >/dev/null
R=$(req POST "$TOK_site" "/screenings/$SID/start" -d '{}')
echo "$R" | grep -q '"status":"screening"' && ok "放映开始" || bad "放映开始: $R"

echo "== 8. 噪声投诉工单：多角色协同 + 办结联动风险/信用 =="
ORG_ID=$(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["organizerId"])')
VENUE_ID=$(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["venueId"])')
CREDIT_BEFORE=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o['creditScore'] for o in json.load(sys.stdin) if o['id']=='$ORG_ID'))")
NOISE_BEFORE=$(req GET "$TOK_street" /venues | python3 -c "import sys,json;print(next(v['noiseCount'] for v in json.load(sys.stdin) if v['id']=='$VENUE_ID'))")
R=$(req POST "$TOK_applicant" "/incidents/screening/$SID" -d '{"type":"noise_complaint","description":"3栋居民反映音响低音共振明显","noiseDb":67}')
INC=$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "$R" | grep -q '"ownerRole":"security"' && ok "噪声工单自动分派安保" || bad "分派: $R"
req POST "$TOK_security" "/incidents/$INC/replies" -d '{"content":"已到场要求调低低音，音箱外摆角度调整","status":"handling"}' >/dev/null
req POST "$TOK_warehouse" "/incidents/$INC/replies" -d '{"content":"仓库建议备用小功率音箱替换一只主音箱"}' >/dev/null
req POST "$TOK_finance" "/incidents/$INC/replies" -d '{"content":"如居民有损失诉求财务跟进赔付口径"}' >/dev/null
R=$(req POST "$TOK_security" "/incidents/$INC/resolve" -d '{"resolution":"音量降至55dB，居民表示接受，投诉办结","confirmed":true}')
echo "$R" | grep -q '"status":"resolved"' && ok "工单办结" || bad "办结: $R"
REPLIES=$(req GET "$TOK_street" "/incidents/$INC" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["replies"]))')
[ "$REPLIES" -ge 4 ] && ok "多角色协同留言 $REPLIES 条" || bad "协同留言数=$REPLIES"
NOISE_AFTER=$(req GET "$TOK_street" /venues | python3 -c "import sys,json;print(next(v['noiseCount'] for v in json.load(sys.stdin) if v['id']=='$VENUE_ID'))")
CREDIT_AFTER=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o['creditScore'] for o in json.load(sys.stdin) if o['id']=='$ORG_ID'))")
[ "$NOISE_AFTER" = $((NOISE_BEFORE+1)) ] && ok "点位噪声计数 $NOISE_BEFORE→$NOISE_AFTER" || bad "噪声计数 $NOISE_BEFORE→$NOISE_AFTER"
[ "$CREDIT_AFTER" = $((CREDIT_BEFORE-8)) ] && ok "主办方信用 $CREDIT_BEFORE→$CREDIT_AFTER (-8)" || bad "信用 $CREDIT_BEFORE→$CREDIT_AFTER"

echo "== 9. 归还：5件完好 + 1件损坏赔付 300 元 =="
i=0
for row in $(echo "$ASSIGN" | python3 -c 'import sys,json;[print("%s,%s"%(x["id"],x["equipmentId"])) for x in json.load(sys.stdin)]'); do
  EID=${row#*,}
  i=$((i+1))
  if [ $i -eq 3 ]; then
    req POST "$TOK_warehouse" "/equipment/screening/$SID/return/$EID" -d '{"result":"returned_damaged","note":"音箱面罩磕碰变形","compensationCents":30000}' >/dev/null
  else
    req POST "$TOK_warehouse" "/equipment/screening/$SID/return/$EID" -d '{"result":"returned_ok"}' >/dev/null
  fi
done
S=$(req GET "$TOK_warehouse" "/screenings/$SID")
echo "$S" | python3 -c 'import sys,json;s=json.load(sys.stdin);assert s["damageCompensation"]=="30000" and s["returnedAt"], "bad"' \
  && ok "6件归还完成、赔付300元、归还时间已记录" || bad "归还/赔付: $(echo "$S" | python3 -c 'import sys,json;s=json.load(sys.stdin);print(s["damageCompensation"],s["returnedAt"])')"

echo "== 10. 未版权核销时关单被拒 =="
R=$(req POST "$TOK_finance" "/screenings/$SID/settlements/complete" -d '{}')
echo "$R" | grep -q '版权尚未核销' && ok "关单前置校验生效" || bad "关单校验: $R"

echo "== 11. 版权核销 + 财务流水（押金退还/补贴）+ 关单 =="
req POST "$TOK_reviewer" "/screenings/$SID/settlements/copyright-writeoff" -d '{}' >/dev/null
req POST "$TOK_finance" "/screenings/$SID/settlements" -d '{"type":"deposit_refund","amountCents":200000,"note":"设备归还无损部分退还押金"}' >/dev/null
req POST "$TOK_finance" "/screenings/$SID/settlements" -d '{"type":"subsidy","amountCents":80000,"note":"街道公益放映补贴"}' >/dev/null
req POST "$TOK_finance" "/screenings/$SID/settlements" -d '{"type":"damage_compensation","amountCents":30000,"note":"音箱面罩赔偿"}' >/dev/null
R=$(req POST "$TOK_finance" "/screenings/$SID/settlements/complete" -d '{"finalRemark":"组织有序，该点位可继续安排夜间活动"}')
echo "$R" | grep -q '"status":"completed"' && ok "关单归档→completed" || bad "关单: $R"

echo "== 12. 时间线节点完整性 =="
TL=$(req GET "$TOK_street" "/screenings/$SID" | python3 -c '
import sys,json
s=json.load(sys.stdin)
kinds={t["kind"] for t in s["timeline"]}
need={"apply","review","prepare","checkout","build","screening","complaint","settlement"}
print("OK" if need<=kinds else "MISS:"+",".join(sorted(need-kinds)))')
[ "$TL" = "OK" ] && ok "时间线覆盖 申请/审批/备料/出库/搭建/放映/投诉/核销" || bad "时间线: $TL"

echo "== 13. 街道看板 =="
R=$(req GET "$TOK_street" /dashboard/overview)
echo "$R" | grep -q '"riskyVenues"' && echo "$R" | grep -q '"recentTimeline"' && ok "看板KPI/风险榜/时间线返回" || bad "看板: $R"
echo "$R" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["kpi"]["completed"]>=1 and d["kpi"]["blacklistedVenues"]>=1' \
  && ok "看板统计：已完成场次≥1、黑名单场地≥1" || bad "看板统计值"

echo "== 14. 强降雨改期全链路（搭建完成后遇暴雨） =="
# 14.1 新建第二场 → 审批 → 备料 → 扫码出库 → 五项现场 → 搭建确认
BODY="{\"title\":\"商圈周末露天放映改期验证\",\"organizerId\":\"$ORG\",\"venueId\":\"$VENUE_OK\",\"showDate\":\"2026-10-18\",\"showTime\":\"19:30\",\"location\":\"广场南侧\",\"expectedAudience\":300,\"filmName\":\"流浪地球2\",\"copyrightProof\":\"ZS-E2E-RAIN\",\"copyrightOwner\":\"中影\",\"powerCondition\":\"配电箱220V/32A\",\"screenSize\":\"8m x 4.5m\",\"speakerCount\":4,\"securityStaff\":6,\"rainPlan\":\"防雨罩+撤场+改期补映\",\"siteManagerName\":\"周强\",\"securityLeadName\":\"孙队\"}"
SID2=$(req POST "$TOK_applicant" /screenings -d "$BODY" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
req POST "$TOK_applicant" "/screenings/$SID2/submit" -d '{}' >/dev/null
req POST "$TOK_reviewer" "/screenings/$SID2/review" -d '{"approved":true,"filingNo":"BA-RAIN-001","comment":"授权与备案通过"}' >/dev/null
req POST "$TOK_warehouse" "/equipment/screening/$SID2/prepare" -d '{}' >/dev/null
ASSIGN2=$(req GET "$TOK_warehouse" "/equipment/screening/$SID2/assignments")
for CODE in $(echo "$ASSIGN2" | python3 -c 'import sys,json;[print(x["equipment"]["code"]) for x in json.load(sys.stdin)]'); do
  req POST "$TOK_warehouse" "/equipment/screening/$SID2/scan" -d "{\"code\":\"$CODE\"}" >/dev/null
done
for CAT in build_setup test_play isolation firelane; do
  req POST "$TOK_site" "/screenings/$SID2/inspections" -d "{\"category\":\"$CAT\",\"detail\":\"$CAT 已完成\"}" >/dev/null
done
req POST "$TOK_security" "/screenings/$SID2/inspections" -d '{"category":"noise","noiseDb":54,"detail":"达标"}' >/dev/null
R=$(req POST "$TOK_site" "/screenings/$SID2/confirm-site" -d '{}')
echo "$R" | grep -q 'site_confirmed' && ok "14.1 第二场搭建确认完成" || bad "14.1 搭建确认: $R"

# 14.2 先发起「临时降雨」异常工单并办结（现场负责人主责）
RINC=$(req POST "$TOK_security" "/incidents/screening/$SID2" -d '{"type":"rain","description":"19:20突降暴雨，气象台橙色预警，现场已加盖防雨罩暂停放映","severity":3}')
RINC_ID=$(echo "$RINC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "$RINC" | grep -q '"ownerRole":"site_manager"' && ok "14.2 降雨工单自动分派现场负责人" || bad "14.2 降雨分派: $RINC"
req POST "$TOK_site" "/incidents/$RINC_ID/resolve" -d '{"resolution":"暴雨持续，启动雨天预案，申请改期","confirmed":true}' >/dev/null

# 14.3 材料不齐：仅传气象截图 -> 仍为 draft 并提示缺项
R=$(req POST "$TOK_site" "/screenings/$SID2/postponement" -d '{"newShowDate":"2026-10-25","newShowTime":"19:30","weatherShotUrl":"rain_alert_20261018.png","weatherNote":"暴雨橙色预警19:00-23:00"}')
echo "$R" | grep -q '"status":"draft"' && ok "14.3 仅传气象截图停留在待补材料" || bad "14.3 材料状态: $R"

# 14.4 补齐四项材料 -> evaluating
R=$(req POST "$TOK_site" "/screenings/$SID2/postponement" -d '{"equipmentOnSite":"投影/幕布/4只音箱/电缆盘已搭建到场，备用灯泡、防雨罩在场","audienceNotice":"现场广播+业主群公告：本场因暴雨改期10-25，凭原通知入场，受影响观众给予补偿","merchantCoord":"周边商户同意外摆顺延；已缴协办费5000元，协商退还3000元，2000元为已发生搭建成本"}')
echo "$R" | grep -q '"status":"evaluating"' && ok "14.4 四项材料齐备进入四方评估" || bad "14.4 材料齐备: $R"

# 14.5 越权评估被拒（仓库不能评估版权）
R=$(req POST "$TOK_warehouse" "/screenings/$SID2/postponement/evaluate" -d '{"dimension":"copyright","reusable":true}')
echo "$R" | grep -q '不由你所在角色' && ok "14.5 版权项仅审核员可评估（越权拦截）" || bad "14.5 越权评估: $R"

# 14.6 四方评估：版权可沿用/设备随套沿用/安保顺延/补贴保留
req POST "$TOK_reviewer" "/screenings/$SID2/postponement/evaluate" -d '{"dimension":"copyright","reusable":true,"note":"授权书覆盖至2026-12-31，备案有效，可沿用"}' >/dev/null
req POST "$TOK_warehouse" "/screenings/$SID2/postponement/evaluate" -d '{"dimension":"equipment","reusable":true,"note":"成套设备继续占用，改期当天随套使用，无需撤场"}' >/dev/null
req POST "$TOK_security" "/screenings/$SID2/postponement/evaluate" -d '{"dimension":"security","reusable":true,"note":"6名安保10-25可顺延排班"}' >/dev/null
R=$(req POST "$TOK_finance" "/screenings/$SID2/postponement/evaluate" -d '{"dimension":"subsidy","reusable":true,"note":"公益场补贴资格保留至改期场次"}')
echo "$R" | grep -q '"status":"fee_pending"' && ok "14.6 四方评估完成→待财务拆费" || bad "14.6 四方评估: $R"

# 14.7 协办费拆分超额被拒
R=$(req POST "$TOK_finance" "/screenings/$SID2/postponement/fee" -d '{"coOrganizerFeePaid":500000,"refundableAmount":400000,"setupCost":200000,"audienceCompensation":500}')
echo "$R" | grep -q '不能超过' && ok "14.7 可退费+搭建成本超额时拦截" || bad "14.7 拆费校验: $R"

# 14.8 正确拆分但观众补偿未通知 -> 确认改期被拒
req POST "$TOK_finance" "/screenings/$SID2/postponement/fee" -d '{"coOrganizerFeePaid":500000,"refundableAmount":300000,"setupCost":200000,"audienceCompensation":500,"audienceCompNotified":false,"feeNote":"3000元退还，2000元搭建人工物料不退，5元/人观众补偿"}' >/dev/null
R=$(req POST "$TOK_street" "/screenings/$SID2/postponement/confirm" -d '{"newShowDate":"2026-10-25","creditPenalty":3}')
echo "$R" | grep -q '观众补偿尚未通知' && ok "14.8 观众补偿未触达时禁止确认改期" || bad "14.8 补偿通知校验: $R"

# 14.9 标记补偿已触达 → 街道确认改期，克隆新场次
req POST "$TOK_finance" "/screenings/$SID2/postponement/fee" -d '{"coOrganizerFeePaid":500000,"refundableAmount":300000,"setupCost":200000,"audienceCompensation":500,"audienceCompNotified":true,"feeNote":"补偿通知已群发触达"}' >/dev/null
CREDIT_B2=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o['creditScore'] for o in json.load(sys.stdin) if o['id']=='$ORG'))")
RAIN_B2=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o.get('rainPostponementCount',0) for o in json.load(sys.stdin) if o['id']=='$ORG'))")
R=$(req POST "$TOK_street" "/screenings/$SID2/postponement/confirm" -d '{"newShowDate":"2026-10-25","newShowTime":"19:30","creditPenalty":3,"remark":"暴雨不可抗力改期"}')
echo "$R" | grep -q 'newScreeningId' && ok "14.9 确认改期并生成新场次" || bad "14.9 确认改期: $R"
NEW_SID=$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["newScreeningId"])')

# 14.10 原场次状态=postponed，版权沿用/设备随套迁移，信用-3、改期次数+1
S2=$(req GET "$TOK_street" "/screenings/$SID2")
echo "$S2" | grep -q '"status":"postponed"' && ok "14.10 原场次置为已改期（不核销）" || bad "14.10 原场次状态: $(echo "$S2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')"
NEW=$(req GET "$TOK_street" "/screenings/$NEW_SID")
echo "$NEW" | python3 -c "import sys,json;s=json.load(sys.stdin);assert s['rescheduledFromId']=='$SID2' and s['status']=='equipment_checked_out' and s['copyrightConfirmed'] and len(s['equipmentAssignments'])==6, s['status']" \
  && ok "14.10 新场次溯源原场次、版权沿用、成套6件随套迁移、直接已出库" \
  || bad "14.10 新场次迁移: $(echo "$NEW" | python3 -c 'import sys,json;s=json.load(sys.stdin);print(s["status"],s["rescheduledFromId"],len(s["equipmentAssignments"]))')"
CREDIT_A2=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o['creditScore'] for o in json.load(sys.stdin) if o['id']=='$ORG'))")
RAIN_A2=$(req GET "$TOK_street" /organizers | python3 -c "import sys,json;print(next(o.get('rainPostponementCount',0) for o in json.load(sys.stdin) if o['id']=='$ORG'))")
[ "$CREDIT_A2" = $((CREDIT_B2-3)) ] && ok "14.10 主办方信用 $CREDIT_B2→$CREDIT_A2 (-3)" || bad "14.10 信用 $CREDIT_B2→$CREDIT_A2"
[ "$RAIN_A2" = $((RAIN_B2+1)) ] && ok "14.10 降雨改期次数 $RAIN_B2→$RAIN_A2" || bad "14.10 改期次数 $RAIN_B2→$RAIN_A2"

# 14.11 原场次不进入正常核销：版权核销/关单/普通流水均被拒
R=$(req POST "$TOK_reviewer" "/screenings/$SID2/settlements/copyright-writeoff" -d '{}')
echo "$R" | grep -q '不进入正常版权核销' && ok "14.11 改期原场次版权核销被拒" || bad "14.11 版权核销拦截: $R"
R=$(req POST "$TOK_finance" "/screenings/$SID2/settlements/complete" -d '{}')
echo "$R" | grep -q '不核销关单' && ok "14.11 改期原场次关单被拒" || bad "14.11 关单拦截: $R"
R=$(req POST "$TOK_finance" "/screenings/$SID2/settlements" -d '{"type":"subsidy","amountCents":100}')
echo "$R" | grep -q '不进入正常核销' && ok "14.11 改期原场次普通核销流水被拒" || bad "14.11 普通流水拦截: $R"

# 14.12 协办费三段拆分已记账到原场次
echo "$S2" | python3 -c '
import sys,json
s=json.load(sys.stdin)
m={r["type"]:int(r["amountCents"]) for r in s["settlements"]}
assert m.get("coorganizer_refund")==300000 and m.get("setup_cost")==200000 and m.get("audience_compensation")==500, m
' && ok "14.12 原场次记账：可退3000/搭建成本2000/观众补偿5元" || bad "14.12 改期费用记账: $(echo "$S2" | python3 -c 'import sys,json;print({r["type"]:r["amountCents"] for r in json.load(sys.stdin)["settlements"]})')"

# 14.13 改期全过程写入活动时间线（kind=rain）
TL2=$(req GET "$TOK_street" "/screenings/$SID2" | python3 -c '
import sys,json
s=json.load(sys.stdin)
titles=[t["title"] for t in s["timeline"] if t["kind"]=="rain"]
print("OK" if any("改期确认" in t for t in titles) and any("材料" in t for t in titles) else "MISS")')
[ "$TL2" = "OK" ] && ok "14.13 时间线记录改期材料/评估/确认节点" || bad "14.13 改期时间线: $TL2"

echo
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
