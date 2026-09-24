import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../../entities/venue.entity';

@Injectable()
export class VenuesService {
  constructor(@InjectRepository(Venue) private readonly repo: Repository<Venue>) {}

  list() {
    return this.repo.find({ order: { blacklisted: 'DESC', noiseCount: 'DESC' } });
  }

  create(data: Partial<Venue>) {
    return this.repo.save(this.repo.create(data));
  }

  async toggleBlacklist(id: string, blacklisted: boolean, reason: string) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('场地不存在');
    v.blacklisted = blacklisted;
    v.blacklistReason = blacklisted ? reason || null : null;
    return this.repo.save(v);
  }

  /** 活动结束后累加风险计数，连续噪声/设备损坏影响下一轮审批 */
  async addRiskCounters(venueId: string, opts: { noise?: boolean; damage?: boolean; complaint?: boolean }) {
    const v = await this.repo.findOne({ where: { id: venueId } });
    if (!v) return;
    if (opts.noise) v.noiseCount += 1;
    if (opts.complaint) v.complaintCount += 1;
    if (opts.damage) v.damageCount += 1;
    await this.repo.save(v);
  }
}
