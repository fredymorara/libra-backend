import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  Delete,
  Param,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('ingest')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async ingestBook(@Req() req, @Body('isbn') isbn: string) {
    return this.catalogService.ingestBookByIsbn(req.user.userId, isbn);
  }

  @Get('queue/status')
  @UseGuards(JwtAuthGuard)
  async getQueueStatus(@Req() req) {
    return this.catalogService.getQueueStatus(req.user.userId);
  }

  @Post('queue/retry')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async retryFailedJobs(@Req() req) {
    return this.catalogService.retryFailedJobs(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getDocuments(@Req() req) {
    return this.catalogService.getDocuments(req.user.userId);
  }

  @Post('upload/csv')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    return this.catalogService.queueCsvForIngestion(
      req.user.userId,
      file.buffer,
    );
  }

  @Post('upload/marc')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMarc(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    return this.catalogService.queueMarcForIngestion(
      req.user.userId,
      file.buffer,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteDocument(@Req() req, @Param('id') id: string) {
    return this.catalogService.deleteDocument(req.user.userId, id);
  }
}
