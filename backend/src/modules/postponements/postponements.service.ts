import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RainPostponement } from '../../entities/rain-postponement.entity';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Organizer } from '../../entities/organizer.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { Equipment } from '../../entities/equipment.entity';
import { Settlement } from '../../entities/settlement.entity';
import {
  CreatePostponementDto, EvaluatePostponementDto, FeeSplitDto, ConfirmPostponementDto,
} from './dto';

const MATERIALS: Array<{ key: keyof RainPostponement; label: string }> = [
  { key: 'weatherShotUrl', label: '气象预警/强降雨截图' },
  { key: 'equipmentOnSite', label: '已到场设备清点' },
  { key: 'audienceNotice', label: '观众通知' },
  { key: 'merchantCoord', label: '商户协调结果' },
];

/** 可发起改期的场次状态：现场搭建确认之后（含放映中）遇强降雨 */
const RAIN_ELIGIBLE_STATUSES = ['site_confirmed', 'screening', 'equipment_checked_out'];

@Injectable()
export class PostponementsService {
  constructor(
    @InjectRepository(RainPostponement) private readonly repo: Repository<RainPostponement>,
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
    @InjectRepository(EquipmentAssignment) private readonly assignRepo: Repository<EquipmentAssignment>,
    @InjectRepository(Equipment) private readonly equipRepo: Repository<Equipment>,
    @InjectRepository(Settlement) private readonly settlementRepo: Repository<Settlement>,
    private readonly dataSource: DataSource,
  ) {}

  /** 场次当前（最新一条）改期单 */
  async byScreening(screeningId: string) {
    const list = await this.repo.find({
      where: { screeningId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return list[0] || null;
  }

  private async requireByScreening(screeningId: string) {
    const p = await this.byScreening(screeningId);
    if (!p) throw new NotFoundException('该场次尚未发起雨天改期，请先由现场负责人上传四项材料');
    return p;
  }

  evaluateBySid(screeningId: string, user: any, dto: EvaluatePostponementDto) {
    return this.requireByScreening(screeningId).then((p) => this.evaluate(p.id, user, dto));
  }

  feeBySid(screeningId: string, user: any, dto: FeeSplitDto) {
    return this.requireByScreening(screeningId).then((p) => this.splitFee(p.id, user, dto));
  }

  confirmBySid(screeningId: string, user: any, dto: ConfirmPostponementDto) {
    return this.requireByScreening(screeningId).then((p) => this.confirm(p.id, user, dto));
  }

  /** 现场负责人发起改期并上传材料（可多次补充，材料齐备进入四方评估） */
  async submitMaterials(screeningId: string, user: any, dto: CreatePostponementDto) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new NotFoundException('场次不存在');
    if (['completed', 'postponed', 'cancelled'].includes(s.status)) {
      throw new BadRequestException('该场次已结束/已改期/已取消，不能再发起改期');
    }
    if (!RAIN_ELIGIBLE_STATUSES.includes(s.status)) {
      throw new BadRequestException('仅设备已到场、现场搭建完成后遇强降雨才能发起改期');
    }

    let p = await this.byScreening(screeningId);
    if (p && p.status === 'confirmed') throw new BadRequestException('该场次改期已确认，不能重复改期');
    if (!p) {
      p = this.repo.create({ screeningId, createdById: user.sub, status: 'draft' });
    }

    if (dto.newShowDate) p.newShowDate = dto.newShowDate;
    if (dto.newShowTime) p.newShowTime = dto.newShowTime;
    if (dto.weatherShotUrl !== undefined) p.weatherShotUrl = dto.weatherShotUrl || null;
    if (dto.weatherNote !== undefined) p.weatherNote = dto.weatherNote || null;
    if (dto.equipmentOnSite !== undefined) p.equipmentOnSite = dto.equipmentOnSite || null;
    if (dto.audienceNotice !== undefined) p.audienceNotice = dto.audienceNotice || null;
    if (dto.merchantCoord !== undefined) p.merchantCoord = dto.merchantCoord || null;

    const missing = this.missingMaterials(p);
    if (missing.length === 0 && p.status === 'draft') p.status = 'evaluating';

    await this.repo.save(p);

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId, kind: 'rain', actorRole: user.role, actorId: user.sub, actorName: user.name,
      title: missing.length === 0 ? '强降雨改期材料齐备，进入沿用评估' : '提交强降雨改期材料',
      detail: missing.length === 0
        ? '气象截图、到场设备、观众通知、商户协调四项材料齐备，等待版权/设备/安保/补贴四方评估'
        : `已上传改期材料，尚缺：${missing.join('、')}`,
    }));
    return this.repo.findOne({ where: { id: p.id } });
  }

  private missingMaterials(p: RainPostponement) {
    return MATERIALS
      .filter((m) => !String((p as any)[m.key] ?? '').trim())
      .map((m) => m.label);
  }

  /** 四方分别判断原场次资源能否沿用到改期场次 */
  async evaluate(id: string, user: any, dto: EvaluatePostponementDto) {    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('改期单不存在');
    if (p.status === 'confirmed') throw new BadRequestException('改期已确认，评估已关闭');
    if (this.missingMaterials(p).length) {
      throw new BadRequestException('四项现场材料未齐备，暂不能进入沿用评估');
    }

    const roleOk =
      (dto.dimension === 'copyright' && ['reviewer', 'street'].includes(user.role)) ||
      (dto.dimension === 'equipment' && ['warehouse', 'street'].includes(user.role)) ||
      (dto.dimension === 'security' && ['security', 'street'].includes(user.role)) ||
      (dto.dimension === 'subsidy' && ['finance', 'street'].includes(user.role));
    if (!roleOk) throw new ForbiddenException('该沿用项不由你所在角色评估');

    switch (dto.dimension) {
      case 'copyright':
        p.copyrightReusable = dto.reusable; p.copyrightNote = dto.note || null; break;
      case 'equipment':
        p.equipmentReusable = dto.reusable; p.equipmentNote = dto.note || null; break;
      case 'security':
        p.securityReusable = dto.reusable; p.securityNote = dto.note || null; break;
      case 'subsidy':
        p.subsidyEligible = dto.reusable; p.subsidyNote = dto.note || null; break;
    }

    if (this.evaluationsDone(p)) p.status = 'fee_pending';
    else if (p.status === 'draft') p.status = 'evaluating';
    await this.repo.save(p);

    const name = {
      copyright: '版权授权日期沿用', equipment: '设备占用沿用',
      security: '安保排班顺延', subsidy: '补贴资格保留',
    }[dto.dimension];
    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: p.screeningId, kind: 'rain', actorRole: user.role, actorId: user.sub, actorName: user.name,
      title: `沿用评估·${name}`,
      detail: `${dto.reusable ? '可以沿用' : '不能沿用，需重新安排'}${dto.note ? `；${dto.note}` : ''}`,
    }));
    return p;
  }

  private evaluationsDone(p: RainPostponement) {
    return p.copyrightReusable !== null && p.equipmentReusable !== null
      && p.securityReusable !== null && p.subsidyEligible !== null;
  }

  /** 财务拆分已缴协办费：可退费用 / 已发生搭建成本 / 观众补偿通知 */
  async splitFee(id: string, user: any, dto: FeeSplitDto) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('改期单不存在');
    if (p.status === 'confirmed') throw new BadRequestException('改期已确认');
    if (!this.evaluationsDone(p)) throw new BadRequestException('四方沿用评估尚未全部完成');

    const audience = dto.audienceCompensation ?? 0;
    if (dto.refundableAmount + dto.setupCost > dto.coOrganizerFeePaid) {
      throw new BadRequestException('可退费用与已发生搭建成本之和不能超过已缴协办费总额');
    }
    p.coOrganizerFeePaid = String(dto.coOrganizerFeePaid);
    p.refundableAmount = String(dto.refundableAmount);
    p.setupCost = String(dto.setupCost);
    p.audienceCompensation = String(audience);
    p.feeNote = dto.feeNote || null;
    p.audienceCompNotified = dto.audienceCompNotified ?? false;
    p.status = 'fee_pending';
    await this.repo.save(p);

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: p.screeningId, kind: 'rain', actorRole: 'finance',
      actorId: user.sub, actorName: user.name,
      title: '协办费拆分与观众补偿口径',
      detail: `已缴协办费 ${dto.coOrganizerFeePaid / 100} 元＝可退 ${dto.refundableAmount / 100} 元`
        + `＋已发生搭建成本 ${dto.setupCost / 100} 元；观众补偿 ${audience / 100} 元`
        + `（${p.audienceCompNotified ? '补偿通知已触达' : '补偿通知待触达'}）`,
    }));
    return p;
  }

  /** 确认改期：原场次置 postponed 不核销，克隆新场次，按沿用结论迁移资源，扣减信用 */
  async confirm(id: string, user: any, dto: ConfirmPostponementDto) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('改期单不存在');
    if (p.status === 'confirmed') throw new BadRequestException('改期已确认，请勿重复操作');
    if (this.missingMaterials(p).length) throw new BadRequestException('四项现场材料未齐备');
    if (!this.evaluationsDone(p)) throw new BadRequestException('版权/设备/安保/补贴四方评估未完成');
    // 已缴协办费场景：财务须先拆分可退费用/搭建成本；存在观众补偿时须已发补偿通知
    if (Number(p.coOrganizerFeePaid) > 0 && Number(p.refundableAmount) + Number(p.setupCost) === 0) {
      throw new BadRequestException('财务尚未拆分已缴协办费（可退费用/搭建成本）');
    }
    if (Number(p.audienceCompensation) > 0 && !p.audienceCompNotified) {
      throw new BadRequestException('观众补偿尚未通知触达，不能确认改期');
    }

    const old = await this.screeningRepo.findOne({
      where: { id: p.screeningId },
      relations: ['venue', 'organizer'],
    });
    if (!old) throw new NotFoundException('原场次不存在');

    const newDate = dto.newShowDate || p.newShowDate;
    if (!newDate) throw new BadRequestException('请确定改期后的放映日期');

    return this.dataSource.transaction(async (mgr) => {
      // 1) 克隆新场次
      const seq = Math.floor(1000 + Math.random() * 9000);
      const fresh = mgr.create(Screening, {
        code: `OC-${newDate.replace(/-/g, '')}-${seq}`,
        title: `${old.title}（降雨改期）`,
        applicantId: old.applicantId,
        organizerId: old.organizerId,
        venueId: old.venueId,
        showDate: newDate,
        showTime: dto.newShowTime || p.newShowTime || old.showTime,
        location: old.location,
        expectedAudience: old.expectedAudience,
        filmName: old.filmName,
        copyrightProof: old.copyrightProof,
        copyrightOwner: old.copyrightOwner,
        powerCondition: old.powerCondition,
        screenSize: old.screenSize,
        speakerCount: old.speakerCount,
        securityStaff: old.securityStaff,
        rainPlan: old.rainPlan,
        siteManagerName: old.siteManagerName,
        securityLeadName: old.securityLeadName,
        rescheduledFromId: old.id,
      });

      // 版权沿用：授权日期覆盖新日期且备案有效 -> 直接审核通过；否则回到待审核重新核验
      if (p.copyrightReusable) {
        fresh.status = 'review_approved';
        fresh.copyrightConfirmed = true;
        fresh.publicEventFiled = true;
        fresh.filingNo = old.filingNo;
        fresh.reviewerName = old.reviewerName;
        fresh.reviewedAt = new Date();
        fresh.reviewComment = '强降雨改期：原版权授权日期覆盖改期日期，授权与备案沿用';
      } else {
        fresh.status = 'pending_review';
        fresh.reviewComment = '强降雨改期：原授权日期不覆盖新日期，需重新核验版权';
      }

      // 2) 设备占用沿用：沿用则把成套绑定迁到新场次；不沿用则原套撤场回库
      const oldAssignments = await mgr.find(EquipmentAssignment, {
        where: { screeningId: old.id }, relations: ['equipment'],
      });
      const savedFresh = await mgr.save(fresh);

      if (p.equipmentReusable && oldAssignments.length) {
        for (const a of oldAssignments) {
          await mgr.save(mgr.create(EquipmentAssignment, {
            screeningId: savedFresh.id,
            equipmentId: a.equipmentId,
            state: a.state === 'prepared' ? 'prepared' : 'checked_out',
            scannedAt: a.scannedAt,
          }));
        }
        // 设备成套沿用且版权也沿用：新场次直接处于已出库阶段；
        // 版权需重核时设备仍占用绑定在新场次，待重新审核通过后继续出库流程。
        if (p.copyrightReusable) {
          savedFresh.status = 'equipment_checked_out';
          await mgr.save(savedFresh);
        }
      } else if (oldAssignments.length) {
        for (const a of oldAssignments) {
          if (!a.state.startsWith('returned') && a.state !== 'lost') {
            a.state = 'returned_ok';
            a.returnedAt = new Date();
            a.returnNote = '强降雨撤场，设备随套收回仓库';
            await mgr.save(a);
            if (a.equipment) {
              a.equipment.status = 'in_stock';
              await mgr.save(a.equipment);
            }
          }
        }
      }

      // 3) 原场次财务：协办费三段拆分 + 观众补偿，均回到原场次记录（不做正常核销）
      const feeEntries: Array<[string, number, string]> = [
        ['coorganizer_refund', Number(p.refundableAmount), '强降雨改期·协办费可退部分'],
        ['setup_cost', Number(p.setupCost), '强降雨改期·已发生搭建成本（不退）'],
        ['audience_compensation', Number(p.audienceCompensation), '强降雨改期·观众补偿'],
      ];
      for (const [type, amount, note] of feeEntries) {
        if (amount > 0) {
          await mgr.save(mgr.create(Settlement, {
            screeningId: old.id, type, amountCents: String(amount), note, operatorId: user.sub,
          }));
        }
      }

      // 4) 原场次置为改期，不进入正常核销
      old.status = 'postponed';
      old.finalRemark = `强降雨改期至 ${newDate}，新场次 ${savedFresh.code}；原场次不核销`;
      await mgr.save(old);

      // 5) 主办方信用：改期结果影响后续申请评分
      const organizer = await mgr.findOne(Organizer, { where: { id: old.organizerId } });
      const penalty = dto.creditPenalty ?? 3;
      if (organizer) {
        organizer.rainPostponementCount += 1;
        if (penalty > 0) {
          organizer.creditScore = Math.max(0, organizer.creditScore - penalty);
          organizer.violationCount += 1;
          organizer.remark = `强降雨改期（${old.code}）扣 ${penalty} 分，影响后续申请评分`;
        }
        await mgr.save(organizer);
      }

      p.status = 'confirmed';
      p.newScreeningId = savedFresh.id;
      p.newShowDate = newDate;
      p.newShowTime = savedFresh.showTime;
      p.creditDelta = penalty;
      p.confirmedAt = new Date();
      await mgr.save(p);

      await mgr.save(mgr.create(TimelineEvent, {
        screeningId: old.id, kind: 'rain', actorRole: user.role,
        actorId: user.sub, actorName: user.name,
        title: '强降雨改期确认·原场次不核销',
        detail: `原场次停止核销并归档为「已改期」，新场次 ${savedFresh.code}（${newDate} ${savedFresh.showTime}）；`
          + `版权${p.copyrightReusable ? '沿用' : '需重核'}、设备${p.equipmentReusable ? '随套沿用' : '撤场回库'}、`
          + `安保${p.securityReusable ? '排班顺延' : '重新排班'}、补贴${p.subsidyEligible ? '资格保留' : '资格取消'}；`
          + `主办方信用 ${penalty > 0 ? `扣减 ${penalty} 分` : '无责不扣分'}`,
      }));
      await mgr.save(mgr.create(TimelineEvent, {
        screeningId: savedFresh.id, kind: 'rain', actorRole: user.role,
        actorId: user.sub, actorName: user.name,
        title: '由强降雨改期生成的新场次',
        detail: `承自原场次 ${old.code}；版权${p.copyrightReusable ? '授权沿用' : '待重新核验'}，`
          + `设备${p.equipmentReusable ? '成套沿用' : '由仓库重新备料'}，`
          + `补贴资格${p.subsidyEligible ? '保留' : '不保留'}`,
      }));

      return { postponement: p, newScreeningId: savedFresh.id, newScreeningCode: savedFresh.code };
    });
  }
}
