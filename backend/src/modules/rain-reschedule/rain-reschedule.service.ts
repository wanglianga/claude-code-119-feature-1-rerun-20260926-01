import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RainReschedule } from '../../entities/rain-reschedule.entity';
import { Screening } from '../../entities/screening.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { Organizer } from '../../entities/organizer.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';

export interface SubmitRainDto {
  weatherShot?: string;
  equipmentArrived?: string;
  audienceNotice?: string;
  merchantCoord?: string;
  rainDetail?: string;
  newShowDate: string;
  newShowTime?: string;
  coOrganizerFeePaid?: boolean;
  coOrganizerFeeTotalCents?: number;
}

export interface JudgeRainDto {
  copyrightReusable?: boolean;
  equipmentReusable?: boolean;
  securityReusable?: boolean;
  subsidyReusable?: boolean;
  copyrightJudgeNote?: string;
  equipmentJudgeNote?: string;
  securityJudgeNote?: string;
  subsidyJudgeNote?: string;
}

export interface FeeRainDto {
  coOrganizerFeePaid?: boolean;
  coOrganizerFeeTotalCents?: number;
  refundCents?: number;
  buildCostCents?: number;
  audienceCompCents?: number;
  audienceCompNotice?: string;
}

@Injectable()
export class RainRescheduleService {
  constructor(
    @InjectRepository(RainReschedule) private readonly repo: Repository<RainReschedule>,
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(EquipmentAssignment) private readonly assignRepo: Repository<EquipmentAssignment>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
    private readonly dataSource: DataSource,
  ) {}

  list(screeningId?: string) {
    const where: any = {};
    if (screeningId) where.screeningId = screeningId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async detail(id: string) {
    const r = await this.repo.findOne({
      where: { id },
      relations: ['screening', 'screening.venue', 'createdBy', 'judge'],
    });
    if (!r) throw new NotFoundException('雨天改期处理单不存在');
    (r as any).equipmentOccupancyHint = await this.equipmentHint(r.screeningId, r.newShowDate);
    return r;
  }

  /** 现场搭建完成后遇强降雨：现场负责人提交四类材料与期望档期 */
  async submit(screeningId: string, user: any, dto: SubmitRainDto) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new NotFoundException('场次不存在');
    // 必须现场搭建完成（确认/放映中）后才走雨天改期
    if (!['site_confirmed', 'screening'].includes(s.status)) {
      throw new BadRequestException('仅现场搭建完成后遇强降雨的场次可申请雨天改期（需已完成现场搭建确认或已开始放映）');
    }
    const existed = await this.repo.findOne({
      where: { screeningId },
      order: { createdAt: 'DESC' },
    });
    if (existed && ['submitted', 'decided'].includes(existed.status)) {
      throw new BadRequestException('该场次已存在处理中的雨天改期单，请勿重复提交');
    }
    if (!dto.newShowDate) throw new BadRequestException('请填写期望改期日期');

    const missing: string[] = [];
    if (!dto.weatherShot) missing.push('气象截图');
    if (!dto.equipmentArrived) missing.push('已到场设备');
    if (!dto.audienceNotice) missing.push('观众通知');
    if (!dto.merchantCoord) missing.push('商户协调结果');
    if (missing.length) throw new BadRequestException(`改期材料不完整，还缺：${missing.join('、')}`);

    const r = await this.repo.save(this.repo.create({
      screeningId,
      status: 'submitted',
      weatherShot: dto.weatherShot,
      equipmentArrived: dto.equipmentArrived,
      audienceNotice: dto.audienceNotice,
      merchantCoord: dto.merchantCoord,
      rainDetail: dto.rainDetail || null,
      newShowDate: dto.newShowDate,
      newShowTime: dto.newShowTime || s.showTime,
      coOrganizerFeePaid: !!dto.coOrganizerFeePaid,
      coOrganizerFeeTotal: String(Math.max(0, Math.round(dto.coOrganizerFeeTotalCents || 0))),
      createdById: user.sub,
    }));

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId, kind: 'rain', actorRole: user.role,
      actorId: user.sub, actorName: user.name,
      title: '强降雨·申请雨天改期',
      detail: `现场搭建完成后遇强降雨，已上传气象截图/到场设备/观众通知/商户协调结果；期望改期至 ${dto.newShowDate} ${dto.newShowTime || s.showTime}`
        + (dto.coOrganizerFeePaid ? `；商户已缴协办费 ${(Math.round(dto.coOrganizerFeeTotalCents || 0) / 100).toFixed(2)} 元` : ''),
    }));
    return this.detail(r.id);
  }

  /**
   * 平台逐项判定四项资源能否沿用：
   * 版权授权日期（审核员）、设备占用（仓库）、安保排班（安保）、补贴资格（财务）。
   * 街道可代任一方一次性判定。四项全部给出结论后处理单进入 decided。
   */
  async judge(id: string, user: any, dto: JudgeRainDto) {
    const r = await this.repo.findOne({ where: { id }, relations: ['screening'] });
    if (!r) throw new NotFoundException('雨天改期处理单不存在');
    if (!['submitted', 'decided'].includes(r.status)) {
      throw new BadRequestException('该改期单已办结，不能再判定');
    }
    if (dto.copyrightReusable !== undefined) { r.copyrightReusable = dto.copyrightReusable; r.copyrightJudgeNote = dto.copyrightJudgeNote ?? r.copyrightJudgeNote; }
    if (dto.equipmentReusable !== undefined) { r.equipmentReusable = dto.equipmentReusable; r.equipmentJudgeNote = dto.equipmentJudgeNote ?? r.equipmentJudgeNote; }
    if (dto.securityReusable !== undefined) { r.securityReusable = dto.securityReusable; r.securityJudgeNote = dto.securityJudgeNote ?? r.securityJudgeNote; }
    if (dto.subsidyReusable !== undefined) { r.subsidyReusable = dto.subsidyReusable; r.subsidyJudgeNote = dto.subsidyJudgeNote ?? r.subsidyJudgeNote; }

    const allJudged = [r.copyrightReusable, r.equipmentReusable, r.securityReusable, r.subsidyReusable]
      .every((v) => v !== null && v !== undefined);
    if (allJudged) {
      r.status = 'decided';
      r.judgeId = user.sub;
      r.judgedAt = new Date();
    }
    await this.repo.save(r);

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: r.screeningId, kind: 'rain', actorRole: user.role,
      actorId: user.sub, actorName: user.name,
      title: allJudged ? '四项沿用判定完成' : '雨天改期沿用判定（进行中）',
      detail: `版权日期${this.mark(r.copyrightReusable)}｜设备占用${this.mark(r.equipmentReusable)}`
        + `｜安保排班${this.mark(r.securityReusable)}｜补贴资格${this.mark(r.subsidyReusable)}`,
    }));
    return this.detail(id);
  }

  /** 财务区分已缴协办费：可退费用 / 已发生搭建成本 / 观众补偿（含通知） */
  async fee(id: string, user: any, dto: FeeRainDto) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('雨天改期处理单不存在');
    if (r.status === 'rescheduled') throw new BadRequestException('改期已执行，费用拆分不可修改');
    r.coOrganizerFeePaid = dto.coOrganizerFeePaid !== undefined ? !!dto.coOrganizerFeePaid : r.coOrganizerFeePaid;
    if (dto.coOrganizerFeeTotalCents !== undefined) r.coOrganizerFeeTotal = String(Math.max(0, Math.round(dto.coOrganizerFeeTotalCents)));
    r.coOrganizerFeeRefund = String(Math.max(0, Math.round(dto.refundCents ?? Number(r.coOrganizerFeeRefund))));
    r.rainBuildCost = String(Math.max(0, Math.round(dto.buildCostCents ?? Number(r.rainBuildCost))));
    r.audienceCompCents = String(Math.max(0, Math.round(dto.audienceCompCents ?? Number(r.audienceCompCents))));
    r.audienceCompNotice = dto.audienceCompNotice ?? r.audienceCompNotice;
    await this.repo.save(r);

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: r.screeningId, kind: 'rain', actorRole: 'finance',
      actorId: user.sub, actorName: user.name,
      title: '协办费拆分与观众补偿',
      detail: `可退费用 ${(Number(r.coOrganizerFeeRefund) / 100).toFixed(2)} 元、`
        + `已发生搭建成本 ${(Number(r.rainBuildCost) / 100).toFixed(2)} 元（不退）、`
        + `观众补偿 ${(Number(r.audienceCompCents) / 100).toFixed(2)} 元`
        + (r.audienceCompNotice ? `；补偿通知：${r.audienceCompNotice}` : ''),
    }));
    return this.detail(id);
  }

  /**
   * 执行改期：
   *  - 原场次置 postponed，不进入正常核销（核销/关单接口对 postponed 拦截）；
   *  - 按四项判定生成改期后新场次，沿用申请要素；版权可沿用则直接审核通过，
   *    设备可沿用则把到场成套设备改挂到新场次（无需重新备料/扫码）；
   *  - 改期结果联动主办方后续申请评分（信用分与改期次数）。
   */
  async confirm(id: string, user: any, dto: { creditDelta?: number; creditImpactNote?: string; remark?: string }) {
    const r = await this.repo.findOne({ where: { id }, relations: ['screening'] });
    if (!r) throw new NotFoundException('雨天改期处理单不存在');
    if (r.status !== 'decided') throw new BadRequestException('需先完成版权/设备/安保/补贴四项判定，才能执行改期');

    const origin = await this.screeningRepo.findOne({
      where: { id: r.screeningId },
      relations: ['venue', 'organizer', 'applicant'],
    });
    if (!origin) throw new NotFoundException('原场次不存在');

    const savedRain = await this.dataSource.transaction(async (mgr) => {
      // 1) 原场次 -> postponed（不核销）
      origin.status = 'postponed';
      await mgr.save(origin);

      // 2) 生成改期后新场次
      const seq = Math.floor(1000 + Math.random() * 9000);
      const ns = mgr.create(Screening, {
        code: `OC-${r.newShowDate.replace(/-/g, '')}-${seq}R`,
        title: `${origin.title}（雨天改期）`,
        applicantId: origin.applicantId,
        organizerId: origin.organizerId,
        venueId: origin.venueId,
        showDate: r.newShowDate,
        showTime: r.newShowTime || origin.showTime,
        location: origin.location,
        expectedAudience: origin.expectedAudience,
        filmName: origin.filmName,
        copyrightProof: origin.copyrightProof,
        copyrightOwner: origin.copyrightOwner,
        powerCondition: origin.powerCondition,
        screenSize: origin.screenSize,
        speakerCount: origin.speakerCount,
        securityStaff: origin.securityStaff,
        rainPlan: origin.rainPlan,
        siteManagerName: origin.siteManagerName,
        securityLeadName: origin.securityLeadName,
        rescheduledFromId: origin.id,
        status: 'draft',
      });

      if (r.copyrightReusable) {
        // 版权授权日期仍覆盖新档期：审核结论沿用，无需重新文化审核
        ns.status = 'review_approved';
        ns.copyrightConfirmed = true;
        ns.publicEventFiled = true;
        ns.filingNo = `${origin.filingNo || 'BA'}-R`;
        ns.reviewerName = user.name;
        ns.reviewedAt = new Date();
        ns.reviewComment = `雨天改期沿用：影片授权日期覆盖 ${r.newShowDate}，审核/备案沿用原场次 ${origin.code}`;
      } else {
        ns.status = 'pending_review';
        ns.reviewComment = `雨天改期至 ${r.newShowDate}，原授权日期不覆盖，需重新核验版权与备案`;
      }
      const savedNew = await mgr.save(ns);

      // 3) 设备可沿用：把原场次已出库到场的成套设备挂到新场次，新场次直接到已出库状态
      if (r.equipmentReusable) {
        const originAssignments = await mgr.find(EquipmentAssignment, {
          where: { screeningId: origin.id }, relations: ['equipment'],
        });
        const onSite = originAssignments.filter((a) => a.state === 'checked_out');
        for (const a of onSite) {
          await mgr.save(mgr.create(EquipmentAssignment, {
            screeningId: savedNew.id,
            equipmentId: a.equipmentId,
            state: 'checked_out',
            scannedAt: new Date(),
          }));
        }
        if (onSite.length && ns.status === 'review_approved') {
          savedNew.status = 'equipment_checked_out';
          await mgr.save(savedNew);
        }
      }

      // 4) 改期结果联动主办方后续申请评分
      const delta = dto.creditDelta ?? -2;
      r.status = 'rescheduled';
      r.newScreeningId = savedNew.id;
      r.organizerCreditDelta = delta;
      r.creditImpactNote = dto.creditImpactNote
        || `强降雨改期 1 次（版权${r.copyrightReusable ? '沿用' : '需重核'}、设备${r.equipmentReusable ? '沿用' : '需重排'}），影响后续申请评分 ${delta} 分`;
      r.finalRemark = dto.remark || r.finalRemark;
      r.rescheduledAt = new Date();
      await mgr.save(r);

      const organizer = await mgr.findOne(Organizer, { where: { id: origin.organizerId } });
      if (organizer) {
        organizer.rescheduleCount += 1;
        if (delta) organizer.creditScore = Math.max(0, Math.min(100, organizer.creditScore + delta));
        organizer.remark = r.creditImpactNote;
        await mgr.save(organizer);
      }

      await mgr.save(mgr.create(TimelineEvent, {
        screeningId: origin.id, kind: 'rain', actorRole: user.role,
        actorId: user.sub, actorName: user.name,
        title: '执行雨天改期·原场次停办待补映',
        detail: `原场次不进入正常核销；改期后新场次 ${savedNew.code}（${r.newShowDate} ${savedNew.showTime}）`
          + `；版权${r.copyrightReusable ? '沿用' : '重新审核'}、设备${r.equipmentReusable ? '成套沿用' : '需重新备料'}`
          + `、安保${r.securityReusable ? '排班沿用' : '重新排班'}、补贴${r.subsidyReusable ? '资格保留' : '资格需重审'}`,
      }));
      await mgr.save(mgr.create(TimelineEvent, {
        screeningId: savedNew.id, kind: 'rain', actorRole: 'system',
        actorName: '系统',
        title: '雨天改期后新场次建立',
        detail: `由原场次 ${origin.code} 因强降雨改期而来；`
          + (r.copyrightReusable ? '影片授权与备案沿用；' : '需重新核验版权授权与备案；')
          + (r.equipmentReusable ? '到场成套设备沿用，无需重新备料扫码；' : '')
          + (r.audienceCompNotice ? `观众补偿通知：${r.audienceCompNotice}` : ''),
      }));

      return mgr.findOne(RainReschedule, { where: { id }, relations: ['screening'] });
    });

    return this.detail(savedRain.id);
  }

  /** 不予改期（材料不实/不具备改期条件），原场次回到现场状态走异常/取消处置 */
  async reject(id: string, user: any, reason: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('雨天改期处理单不存在');
    if (r.status === 'rescheduled') throw new BadRequestException('改期已执行，不能驳回');
    r.status = 'rejected';
    r.finalRemark = reason;
    r.judgeId = user.sub;
    r.judgedAt = new Date();
    await this.repo.save(r);
    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: r.screeningId, kind: 'rain', actorRole: user.role,
      actorId: user.sub, actorName: user.name,
      title: '雨天改期申请不予通过',
      detail: reason || '材料不充分或不具备改期条件',
    }));
    return this.detail(id);
  }

  private mark(v: boolean | null | undefined) {
    return v === true ? '✅可沿用' : v === false ? '❌不可沿用' : '⏳待判定';
  }

  /** 设备占用提示：查同套设备在新档期是否被其他有效场次占用 */
  private async equipmentHint(screeningId: string, newDate: string | null): Promise<string> {
    if (!newDate) return '未填改期日期，暂无法判断设备占用';
    const mine = await this.assignRepo.find({
      where: { screeningId }, relations: ['equipment'],
    });
    const kitNos = Array.from(new Set(mine.map((a) => a.equipment?.kitNo).filter(Boolean))) as string[];
    if (!kitNos.length) return '原场次尚无成套设备记录，需仓库确认备料';
    const others = await this.assignRepo
      .createQueryBuilder('a')
      .innerJoin('a.screening', 's')
      .innerJoin('a.equipment', 'e')
      .where('s.id <> :sid', { sid: screeningId })
      .andWhere('s.showDate = :d', { d: newDate })
      .andWhere('s.status NOT IN (:...st)', { st: ['cancelled', 'postponed', 'completed'] })
      .andWhere('e.kitNo IN (:...kits)', { kits: kitNos })
      .getCount();
    return others === 0
      ? `套号 ${kitNos.join('、')} 在 ${newDate} 无其他场次占用，可沿用`
      : `套号 ${kitNos.join('、')} 在 ${newDate} 存在 ${others} 件被其他场次占用，需仓库重新调度`;
  }
}
