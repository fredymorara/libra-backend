import fs from 'fs';
import path from 'path';

const basePath = process.cwd() + '/src';

const structure = {
  'auth/dto': {},
  'auth/guards': {},
  'auth/strategies': {},
  'auth/auth.module.ts': `import { Module } from '@nestjs/common';\nimport { AuthController } from './auth.controller';\nimport { AuthService } from './auth.service';\n\n@Module({\n  controllers: [AuthController],\n  providers: [AuthService]\n})\nexport class AuthModule {}`,
  'auth/auth.controller.ts': `import { Controller } from '@nestjs/common';\n\n@Controller('auth')\nexport class AuthController {}`,
  'auth/auth.service.ts': `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AuthService {}`,
  'database/schema/users.ts': `export const users = {};`,
  'database/schema/documents.ts': `export const documents = {};`,
  'database/schema/chunks.ts': `export const chunks = {};`,
  'database/database.module.ts': `import { Module } from '@nestjs/common';\n\n@Module({})\nexport class DatabaseModule {}`,
  'database/drizzle.provider.ts': `export const DrizzleProvider = {};`,
  'catalog/catalog.module.ts': `import { Module } from '@nestjs/common';\nimport { CatalogController } from './catalog.controller';\nimport { CatalogService } from './catalog.service';\n\n@Module({\n  controllers: [CatalogController],\n  providers: [CatalogService]\n})\nexport class CatalogModule {}`,
  'catalog/catalog.controller.ts': `import { Controller } from '@nestjs/common';\n\n@Controller('catalog')\nexport class CatalogController {}`,
  'catalog/catalog.service.ts': `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class CatalogService {}`,
  'search/search.module.ts': `import { Module } from '@nestjs/common';\nimport { SearchController } from './search.controller';\nimport { SearchService } from './search.service';\n\n@Module({\n  controllers: [SearchController],\n  providers: [SearchService]\n})\nexport class SearchModule {}`,
  'search/search.controller.ts': `import { Controller } from '@nestjs/common';\n\n@Controller('search')\nexport class SearchController {}`,
  'search/search.service.ts': `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class SearchService {}`,
  'rag/rag.module.ts': `import { Module } from '@nestjs/common';\nimport { RagController } from './rag.controller';\nimport { RagService } from './rag.service';\n\n@Module({\n  controllers: [RagController],\n  providers: [RagService]\n})\nexport class RagModule {}`,
  'rag/rag.controller.ts': `import { Controller } from '@nestjs/common';\n\n@Controller('rag')\nexport class RagController {}`,
  'rag/rag.service.ts': `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class RagService {}`
};

for (const [fileOrDir, content] of Object.entries(structure)) {
  const fullPath = path.join(basePath, fileOrDir);
  if (typeof content === 'object') {
    fs.mkdirSync(fullPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
}

console.log('Scaffolding complete!');
