import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolunteerCheckin } from '../../entities/volunteer-checkin.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(VolunteerCheckin) private readonly repo: Repository<VolunteerCheckin>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
  ) {}

  list(screeningId: string) {
    return this.repo.find({ where: { screeningId }, order: { createdAt: 'ASC' } });
  }

  async checkin(screeningId: string, user: any, dto: { volunteerName: string; phone: string; duty?: string }) {
    if (!dto.volunteerName || !dto.phone) throw new BadRequestException('志愿者姓名与手机号必填');
    const rec = await this.repo.save(this.repo.create({
      screeningId,
      volunteerName: dto.volunteerName,
      phone: dto.phone,
      duty: dto.duty || '秩序维护',
      checkedInAt: new Date(),
      state: 'checked_in',
      operatorId: user.sub,
    }));
    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId, kind: 'volunteer', actorRole: user.role, actorId: user.sub, actorName: user.name,
      title: '志愿者签到', detail: `${dto.volunteerName}（${dto.duty || '秩序维护'}）已到场签到`,
    }));
    return rec;
  }

  async checkout(id: string, user: any) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('签到记录不存在');
    if (v.state === 'checked_out') throw new BadRequestException('已签退');
    v.state = 'checked_out';
    v.checkedOutAt = new Date();
    await this.repo.save(v);
    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId: v.screeningId, kind: 'volunteer', actorRole: user.role,
      actorId: user.sub, actorName: user.name,
      title: '志愿者签退', detail: `${v.volunteerName} 完成服务并签退`,
    }));
    return v;
  }
}
