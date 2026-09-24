import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident, IncidentReply } from '../../entities/incident.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Screening } from '../../entities/screening.entity';
import { VenuesService } from '../venues/venues.service';
import { OrganizersService } from '../organizers/organizers.service';

export const INCIDENT_TYPES: Record<string, { name: string; ownerRole: string; risk?: 'noise' | 'damage' | 'complaint'; creditDelta?: number }> = {
  film_corrupt: { name: '影片文件损坏', ownerRole: 'reviewer' },
  equipment_missing: { name: '设备缺件', ownerRole: 'warehouse', risk: 'damage', creditDelta: -5 },
  noise_complaint: { name: '居民投诉噪声', ownerRole: 'security', risk: 'noise', creditDelta: -8 },
  rain: { name: '临时降雨', ownerRole: 'site_manager' },
  overcrowd: { name: '观众超员', ownerRole: 'security', risk: 'complaint', creditDelta: -5 },
  power_trip: { name: '供电跳闸', ownerRole: 'site_manager' },
  extension: { name: '商户要求延长活动', ownerRole: 'reviewer' },
};

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private readonly repo: Repository<Incident>,
    @InjectRepository(IncidentReply) private readonly replyRepo: Repository<IncidentReply>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    private readonly venues: VenuesService,
    private readonly organizers: OrganizersService,
  ) {}

  list(screeningId?: string, status?: string) {
    const where: any = {};
    if (screeningId) where.screeningId = screeningId;
    if (status) where.status = status;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['createdBy'],
    });
  }

  async detail(id: string) {
    const inc = await this.repo.findOne({
      where: { id },
      relations: ['createdBy', 'screening'],
    });
    if (!inc) throw new NotFoundException('异常工单不存在');
    (inc as any).replies = await this.replyRepo.find({ where: { incidentId: id }, order: { createdAt: 'ASC' } });
    return inc;
  }

  async create(screeningId: string, user: any, dto: {
    type: string; title?: string; description: string; noiseDb?: number; severity?: number;
  }) {
    const meta = INCIDENT_TYPES[dto.type];
    if (!meta) throw new BadRequestException('未知的异常类型');
    const screening = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!screening) throw new NotFoundException('场次不存在');

    const inc = await this.repo.save(this.repo.create({
      screeningId,
      type: dto.type,
      title: dto.title || meta.name,
      description: dto.description,
      noiseDb: dto.noiseDb ?? null,
      severity: dto.severity || (dto.type === 'noise_complaint' ? 2 : 1),
      ownerRole: meta.ownerRole,
      createdById: user.sub,
      status: 'open',
    }));

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId,
      kind: dto.type === 'noise_complaint' ? 'complaint' : 'incident',
      actorRole: user.role,
      actorId: user.sub,
      actorName: user.name,
      title: `异常工单：${meta.name}`,
      detail: dto.description + (dto.noiseDb ? `（现场实测 ${dto.noiseDb} dB）` : '')
        + `｜主责：${this.roleName(meta.ownerRole)}`,
    }));
    return this.detail(inc.id);
  }

  async reply(id: string, user: any, content: string, newStatus?: string) {
    const inc = await this.repo.findOne({ where: { id } });
    if (!inc) throw new NotFoundException('异常工单不存在');
    if (inc.status === 'resolved') throw new BadRequestException('工单已办结，不能继续留言');
    await this.replyRepo.save(this.replyRepo.create({
      incidentId: id, userId: user.sub, content,
    }));
    if (newStatus === 'handling' && inc.status === 'open') {
      inc.status = 'handling';
      await this.repo.save(inc);
    }
    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: inc.screeningId,
      kind: 'incident',
      actorRole: user.role,
      actorId: user.sub,
      actorName: user.name,
      title: `协同处理·${INCIDENT_TYPES[inc.type]?.name || inc.title}`,
      detail: `[${this.roleName(user.role)}] ${content}`,
    }));
    return this.detail(id);
  }

  /** 办结：申请方/审核员/仓库/现场/安保/财务任一方均可登记处理结果；
   *  确认成立的噪声、设备损坏、超员投诉联动场地风险计数与主办方信用分。 */
  async resolve(id: string, user: any, dto: { resolution: string; confirmed?: boolean }) {
    const inc = await this.repo.findOne({ where: { id }, relations: ['screening'] });
    if (!inc) throw new NotFoundException('异常工单不存在');
    if (inc.status === 'resolved') throw new BadRequestException('工单已办结');
    inc.status = 'resolved';
    inc.resolution = dto.resolution;
    inc.resolvedAt = new Date();
    await this.repo.save(inc);

    await this.replyRepo.save(this.replyRepo.create({
      incidentId: id, userId: user.sub,
      content: `【办结】${dto.resolution}`,
    }));

    const confirmed = dto.confirmed !== false;
    const meta = INCIDENT_TYPES[inc.type];
    if (confirmed && meta?.risk) {
      await this.venues.addRiskCounters(inc.screening.venueId, {
        noise: meta.risk === 'noise',
        damage: meta.risk === 'damage',
        complaint: meta.risk === 'complaint' || meta.risk === 'noise',
      });
    }
    if (confirmed && meta?.creditDelta) {
      await this.organizers.addViolation(
        inc.screening.organizerId, meta.creditDelta,
        `${meta.name}工单 ${inc.id.slice(0, 8)} 扣减信用`,
      );
    }

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: inc.screeningId,
      kind: 'incident',
      actorRole: user.role,
      actorId: user.sub,
      actorName: user.name,
      title: `异常办结：${INCIDENT_TYPES[inc.type]?.name || inc.title}`,
      detail: `${dto.resolution}${confirmed && meta?.risk ? '（已计入点位风险与主办方信用）' : ''}`,
    }));
    return this.detail(id);
  }

  private roleName(r: string) {
    return ({
      applicant: '申请方', reviewer: '审核员', warehouse: '仓库',
      site_manager: '现场负责人', security: '安保', finance: '财务', street: '街道文体岗',
    } as Record<string, string>)[r] || r;
  }
}
