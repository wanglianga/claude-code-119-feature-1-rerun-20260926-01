import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from '../../entities/inspection.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';

const CATEGORY_META: Record<string, { name: string; kind: string }> = {
  build_setup: { name: '搭建照片', kind: 'build' },
  test_play: { name: '试播截图', kind: 'test_play' },
  noise: { name: '噪声分贝', kind: 'noise' },
  isolation: { name: '观众区域隔离', kind: 'isolation' },
  firelane: { name: '消防通道', kind: 'firelane' },
};

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection) private readonly repo: Repository<Inspection>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
  ) {}

  list(screeningId: string) {
    return this.repo.find({ where: { screeningId }, order: { createdAt: 'ASC' } });
  }

  async upload(screeningId: string, user: any, dto: {
    category: string; photoUrl?: string; noiseDb?: number; detail?: string; passed?: boolean;
  }) {
    const meta = CATEGORY_META[dto.category];
    if (!meta) throw new BadRequestException('未知的巡检类别');
    if (dto.category === 'noise') {
      if (dto.noiseDb == null) throw new BadRequestException('噪声巡检必须填写分贝值');
      // 夜间露天活动噪声参考阈值 60dB，超阈值默认不合格（仍可由现场说明后人工通过）
      dto.passed = dto.passed ?? dto.noiseDb <= 60;
    } else {
      dto.passed = dto.passed ?? true;
    }

    const rec = await this.repo.save(this.repo.create({
      screeningId,
      reporterId: user.sub,
      category: dto.category,
      photoUrl: dto.photoUrl || `${dto.category}_${Date.now()}.jpg`,
      noiseDb: dto.noiseDb ?? null,
      detail: dto.detail || null,
      passed: dto.passed,
    }));

    await this.timelineRepo.save(this.timelineRepo.create({
      screeningId,
      kind: meta.kind,
      actorRole: user.role,
      actorId: user.sub,
      actorName: user.name,
      title: `现场上报·${meta.name}`,
      detail: dto.category === 'noise'
        ? `实测 ${dto.noiseDb} dB，${dto.passed ? '达标' : '超标（≥60dB），已通知调小音量并通报安保'}`
        : (dto.detail || `已上传${meta.name}，结论：${dto.passed ? '合格' : '不合格'}`),
    }));
    return rec;
  }
}
