import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));

  // 生产环境：同容器托管 Vue 构建产物（位于 ../public），非 /api 路径回退 index.html
  const publicDir = join(__dirname, '..', 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) return next();
      return res.sendFile(join(publicDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`backend listening on :${port}`);
}
bootstrap();
