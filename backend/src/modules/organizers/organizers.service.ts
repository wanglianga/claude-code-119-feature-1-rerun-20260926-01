import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organizer } from '../../entities/organizer.entity';

@Injectable()
export class OrganizersService {
  constructor(@InjectRepository(Organizer) private readonly repo: Repository<Organizer>) {}

  list() {
    return this.repo.find({ order: { creditScore: 'ASC' } });
  }

  async addViolation(id: string, scoreDelta: number, remark: string) {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('主办方不存在');
    o.creditScore = Math.max(0, Math.min(100, o.creditScore + scoreDelta));
    o.violationCount += 1;
    if (remark) o.remark = remark;
    return this.repo.save(o);
  }

  async adjustDeposit(id: string, deltaCents: number) {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('主办方不存在');
    const next = Number(o.depositBalance) + deltaCents;
    o.depositBalance = String(Math.max(0, next));
    return this.repo.save(o);
  }

  async incrementScreenings(id: string) {
    const o = await this.repo.findOne({ where: { id } });
    if (o) {
      o.totalScreenings += 1;
      await this.repo.save(o);
    }
  }
}
