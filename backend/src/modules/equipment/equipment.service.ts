import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Equipment } from '../../entities/equipment.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';

const KIT_TYPES = ['projector', 'screen', 'speaker', 'cable', 'bulb', 'raincoat'] as const;
const TYPE_NAME: Record<string, string> = {
  projector: '投影机', screen: '幕布', speaker: '音箱',
  cable: '电缆', bulb: '备用灯泡', raincoat: '防雨罩',
};

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment) private readonly equipRepo: Repository<Equipment>,
    @InjectRepository(EquipmentAssignment) private readonly assignRepo: Repository<EquipmentAssignment>,
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
    private readonly dataSource: DataSource,
  ) {}

  list(query: { status?: string; type?: string; kitNo?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.kitNo) where.kitNo = query.kitNo;
    return this.equipRepo.find({ where, order: { kitNo: 'ASC', code: 'ASC' } });
  }

  kits() {
    // 以成套为视角汇总每套六件状态
    return this.list({}).then((all) => {
      const map = new Map<string, any>();
      for (const e of all) {
        if (!map.has(e.kitNo)) {
          map.set(e.kitNo, {
            kitNo: e.kitNo, items: [], complete: true, allInStock: true,
          });
        }
        const k = map.get(e.kitNo);
        k.items.push(e);
        if (KIT_TYPES.includes(e.type as any) === false) k.complete = false;
        if (e.status !== 'in_stock') k.allInStock = false;
      }
      for (const k of map.values()) {
        const types = new Set(k.items.map((i: Equipment) => i.type));
        k.complete = KIT_TYPES.every((t) => types.has(t));
      }
      return Array.from(map.values());
    });
  }

  async assignmentsOf(screeningId: string) {
    return this.assignRepo.find({
      where: { screeningId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 仓库按场次准备一整套（投影机/幕布/音箱/电缆/备用灯泡/防雨罩） */
  async prepareKit(screeningId: string, user: any, kitNo?: string) {
    const screening = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!screening) throw new NotFoundException('场次不存在');
    if (!['review_approved', 'equipment_prepared'].includes(screening.status)) {
      throw new BadRequestException('仅审核通过的场次可准备设备');
    }
    const existed = await this.assignRepo.find({ where: { screeningId } });
    if (existed.some((a) => a.state !== 'returned_ok')) {
      if (screening.status === 'equipment_prepared') {
        return { screening, assignments: existed, reused: true };
      }
    }

    let targetKit = kitNo;
    if (!targetKit) {
      const stock = await this.equipRepo.find({ where: { status: 'in_stock' }, order: { kitNo: 'ASC' } });
      const groups = new Map<string, Equipment[]>();
      for (const e of stock) {
        if (!groups.has(e.kitNo)) groups.set(e.kitNo, []);
        groups.get(e.kitNo)!.push(e);
      }
      for (const [no, items] of groups) {
        const types = new Set(items.map((i) => i.type));
        if (KIT_TYPES.every((t) => types.has(t))) { targetKit = no; break; }
      }
    }
    if (!targetKit) throw new BadRequestException('仓库暂无完整成套设备（六件齐全且在库）');

    const items = await this.equipRepo.find({
      where: { kitNo: targetKit, type: In(KIT_TYPES as any), status: 'in_stock' },
    });
    if (items.length !== KIT_TYPES.length) {
      throw new BadRequestException(`成套 ${targetKit} 不完整或缺件，无法出库（应有6件，实有${items.length}件）`);
    }

    return this.dataSource.transaction(async (mgr) => {
      for (const e of items) {
        e.status = 'prepared';
        await mgr.save(e);
        await mgr.save(mgr.create(EquipmentAssignment, {
          screeningId, equipmentId: e.id, state: 'prepared',
        }));
      }
      screening.status = 'equipment_prepared';
      await mgr.save(screening);
      await mgr.save(mgr.create(TimelineEvent, {
        screeningId, kind: 'prepare', actorRole: 'warehouse', actorId: user.sub, actorName: user.name,
        title: '仓库成套备料完成',
        detail: `设备套号 ${targetKit}：${items.map((i) => TYPE_NAME[i.type]).join('、')} 共6件`,
      }));
      const assignments = await mgr.find(EquipmentAssignment, {
        where: { screeningId }, relations: ['equipment'],
      });
      return { screening, assignments, kitNo: targetKit };
    });
  }

  /** 设备领取时扫码：核对所扫资产属于本场成套，逐件确认，六件齐则出库 */
  async scan(screeningId: string, code: string, user: any) {
    const screening = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!screening) throw new NotFoundException('场次不存在');
    if (!['equipment_prepared', 'equipment_checked_out'].includes(screening.status)) {
      throw new BadRequestException('当前场次不在待领取/领取中状态');
    }
    const equip = await this.equipRepo.findOne({ where: { code } });
    if (!equip) throw new BadRequestException(`扫码失败：资产编码 ${code} 不存在`);

    const assignments = await this.assignRepo.find({
      where: { screeningId }, relations: ['equipment'],
    });
    const mine = assignments.find((a) => a.equipmentId === equip.id);
    if (!mine) {
      throw new BadRequestException(
        `成套核对失败：${equip.name}(${code}) 不属于本场次 ${screening.code} 的成套设备，请重新扫码`,
      );
    }
    if (mine.state === 'checked_out') {
      return { assignment: mine, alreadyScanned: true, remaining: this.remaining(assignments) };
    }
    mine.state = 'checked_out';
    mine.scannedAt = new Date();
    equip.status = 'checked_out';
    await this.assignRepo.save(mine);
    await this.equipRepo.save(equip);

    const remaining = this.remaining(assignments);
    if (remaining === 0) {
      screening.status = 'equipment_checked_out';
      await this.screeningRepo.save(screening);
      await this.timelineRepo.save(this.timelineRepo.create({
        screeningId, kind: 'checkout', actorRole: 'warehouse', actorId: user.sub, actorName: user.name,
        title: '扫码核对完成，设备出库',
        detail: `成套6件全部扫码核对无误，现场负责人领取出库`,
      }));
    }
    return { assignment: mine, remaining, kitComplete: remaining === 0 };
  }

  private remaining(assignments: EquipmentAssignment[]) {
    return assignments.filter((a) => a.state !== 'checked_out').length;
  }

  /** 活动结束归还：逐件登记 完好/损坏/遗失 与赔付；全部归还后记录归还时间 */
  async returnItem(screeningId: string, equipmentId: string, user: any,
                   dto: { result: 'returned_ok' | 'returned_damaged' | 'lost'; note?: string; compensationCents?: number }) {
    const screening = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!screening) throw new NotFoundException('场次不存在');
    if (screening.status === 'postponed') {
      throw new BadRequestException('该场次已雨天改期，到场设备由改期后新场次承接，归还/核销请到改期后场次办理');
    }
    const a = await this.assignRepo.findOne({ where: { screeningId, equipmentId }, relations: ['equipment'] });
    if (!a) throw new NotFoundException('该设备未在本场次领用记录中');
    if (a.state.startsWith('returned') || a.state === 'lost') {
      throw new BadRequestException('该设备已归还登记，不能重复操作');
    }
    a.state = dto.result;
    a.returnedAt = new Date();
    a.returnNote = dto.note || null;
    a.compensation = String(dto.compensationCents || 0);
    await this.assignRepo.save(a);

    a.equipment.status = dto.result === 'returned_ok' ? 'in_stock' : dto.result === 'lost' ? 'lost' : 'damaged';
    a.equipment.condition = dto.result === 'returned_ok' ? a.equipment.condition : Math.max(0, a.equipment.condition - 30);
    a.equipment.note = dto.note || a.equipment.note;
    await this.equipRepo.save(a.equipment);

    const all = await this.assignRepo.find({ where: { screeningId } });
    const damageTotal = all
      .filter((x) => x.state === 'returned_damaged' || x.state === 'lost')
      .reduce((sum, x) => sum + Number(x.compensation), 0);
    screening.damageCompensation = String(damageTotal);

    if (all.every((x) => x.state.startsWith('returned') || x.state === 'lost')) {
      screening.returnedAt = new Date();
      await this.timelineRepo.save(this.timelineRepo.create({
        screeningId, kind: 'return', actorRole: 'warehouse', actorId: user.sub, actorName: user.name,
        title: '设备全部归还',
        detail: `完好 ${all.filter((x) => x.state === 'returned_ok').length} 件，`
          + `损坏/遗失 ${all.filter((x) => x.state !== 'returned_ok').length} 件，核定赔付 ${damageTotal} 分`,
      }));
    }
    await this.screeningRepo.save(screening);
    return a;
  }
}
