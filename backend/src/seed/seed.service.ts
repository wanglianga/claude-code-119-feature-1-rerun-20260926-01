import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';
import { Screening } from '../entities/screening.entity';
import { Equipment } from '../entities/equipment.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed');

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Organizer) private readonly organizerRepo: Repository<Organizer>,
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
  ) {}

  async onModuleInit() {
    await this.waitForDb();
    if ((await this.userRepo.count()) > 0) {
      this.logger.log('seed skipped: data already exists');
      return;
    }
    await this.run();
  }

  private async waitForDb(retries = 30) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.userRepo.query('SELECT 1');
        return;
      } catch {
        this.logger.warn(`waiting for database... (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error('database not reachable');
  }

  private async run() {
    const pwd = await bcrypt.hash('123456', 10);
    const mkUser = (u: Partial<User>) => this.userRepo.save(this.userRepo.create({ password: pwd, ...u }));

    const applicant = await mkUser({
      username: 'applicant', name: '王磊', role: 'applicant',
      organization: '幸福里社区居委会', organizerName: '幸福里社区居委会',
    });
    await mkUser({
      username: 'applicant2', name: '陈静', role: 'applicant',
      organization: '星光商圈运营公司', organizerName: '星光商圈运营公司',
    });
    await mkUser({
      username: 'reviewer', name: '李文（文化审核）', role: 'reviewer',
      organization: '区文旅局',
    });
    await mkUser({
      username: 'warehouse', name: '老赵（仓库）', role: 'warehouse',
      organization: '街道文体设备仓',
    });
    await mkUser({
      username: 'site', name: '周强（现场负责人）', role: 'site_manager',
      organization: '幸福里社区',
    });
    await mkUser({
      username: 'security', name: '孙队（安保）', role: 'security',
      organization: '街道安保中队',
    });
    await mkUser({
      username: 'finance', name: '吴会计（财务）', role: 'finance',
      organization: '街道财务室',
    });
    await mkUser({
      username: 'street', name: '郑岗（街道文体岗）', role: 'street',
      organization: '阳光街道办事处文体岗',
    });

    const org1 = await this.organizerRepo.save(this.organizerRepo.create({
      name: '幸福里社区居委会', organizerType: '社区',
      contactName: '王磊', contactPhone: '13800000001',
      creditScore: 96, depositBalance: '200000', totalScreenings: 12, violationCount: 1,
      remark: '去年一次噪声投诉，已整改',
    }));
    const org2 = await this.organizerRepo.save(this.organizerRepo.create({
      name: '星光商圈运营公司', organizerType: '商圈',
      contactName: '陈静', contactPhone: '13800000002',
      creditScore: 88, depositBalance: '500000', totalScreenings: 20, violationCount: 3,
    }));
    await this.organizerRepo.save(this.organizerRepo.create({
      name: '江景苑物业服务中心', organizerType: '物业',
      contactName: '马丽', contactPhone: '13800000003',
      creditScore: 72, depositBalance: '200000', totalScreenings: 8, violationCount: 4,
      remark: '多次设备损坏+噪声，押金已上浮',
    }));

    const v1 = await this.venueRepo.save(this.venueRepo.create({
      name: '幸福里社区中心广场', address: '阳光路88号', district: '阳光街道',
      venueType: '社区广场', capacity: 300,
      noiseCount: 1, damageCount: 0, complaintCount: 1,
    }));
    const v2 = await this.venueRepo.save(this.venueRepo.create({
      name: '星光时代广场外摆区', address: '星光大道200号', district: '阳光街道',
      venueType: '商圈外摆', capacity: 500,
      noiseCount: 2, damageCount: 1, complaintCount: 3,
    }));
    await this.venueRepo.save(this.venueRepo.create({
      name: '江景苑小区中庭（暂停）', address: '江景路12号', district: '阳光街道',
      venueType: '物业小区', capacity: 150,
      blacklisted: true, blacklistReason: '连续3次夜间噪声投诉+音箱损坏，列入场地黑名单，暂停夜间放映',
      noiseCount: 4, damageCount: 2, complaintCount: 5,
    }));

    // 两套完整设备，每套六件
    const typeDefs: Array<[Equipment['type'], string, string]> = [
      ['projector', '投影机', 'PJ'],
      ['screen', '折叠幕布', 'SC'],
      ['speaker', '专业音箱', 'SP'],
      ['cable', '供电电缆盘', 'CA'],
      ['bulb', '备用灯泡', 'BL'],
      ['raincoat', '设备防雨罩', 'RC'],
    ];
    for (const kit of ['KIT-01', 'KIT-02']) {
      for (const [type, name, prefix] of typeDefs) {
        const seq = Math.floor(1000 + Math.random() * 9000);
        await this.equipmentRepo.save(this.equipmentRepo.create({
          code: `${prefix}-${kit.slice(-2)}${String(seq).slice(-3)}`,
          name, type, kitNo: kit, status: 'in_stock', condition: type === 'bulb' ? 100 : 90,
        }));
      }
    }

    // 演示场次：一条待审核，一条审核通过待备设备
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await this.screeningRepo.save(this.screeningRepo.create({
      code: `OC-${future.replace(/-/g, '')}-1001`,
      title: '国庆公益露天电影《我和我的祖国》',
      applicantId: applicant.id, organizerId: org1.id, venueId: v1.id,
      showDate: future, showTime: '19:30', location: '幸福里社区中心广场北侧（靠近配电箱）',
      expectedAudience: 260,
      filmName: '我和我的祖国', copyrightProof: '中影授权书 ZS-2026-0886',
      copyrightOwner: '中国电影股份有限公司',
      powerCondition: '广场东侧市政配电箱，220V/16A，接线约40米',
      screenSize: '6m x 3.4m', speakerCount: 2, securityStaff: 4,
      rainPlan: '如遇降雨，启用防雨罩保护设备，观众转移至社区活动中心二层多功能厅续映',
      siteManagerName: '周强', securityLeadName: '孙队',
      status: 'pending_review',
    }));

    const future2 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await this.screeningRepo.save(this.screeningRepo.create({
      code: `OC-${future2.replace(/-/g, '')}-2002`,
      title: '星光商圈周末露天放映《流浪地球2》',
      applicantId: applicant.id, organizerId: org2.id, venueId: v2.id,
      showDate: future2, showTime: '20:00', location: '星光时代广场外摆区B区',
      expectedAudience: 420,
      filmName: '流浪地球2', copyrightProof: '中影数字院线放映许可 XK-2026-1120',
      copyrightOwner: '中影数字电影发展（北京）有限公司',
      powerCondition: '商户外接电源 220V/32A，电缆25米',
      screenSize: '8m x 4.5m', speakerCount: 4, securityStaff: 6,
      rainPlan: '降雨时设备加盖防雨罩并撤入商场一层卸货区，观众凭票次日补映',
      siteManagerName: '周强', securityLeadName: '孙队',
      status: 'review_approved',
      copyrightConfirmed: true, publicEventFiled: true, filingNo: 'BA-20260920-22',
      reviewerName: '李文（文化审核）', reviewedAt: new Date(),
      reviewComment: '影片授权与备案材料齐全，同意放映',
    }));

    this.logger.log('seed completed: 8 users / 3 organizers / 3 venues / 12 equipment / 2 screenings');
  }
}
