import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import { ImportService } from './import.service';

@Controller('import')
export class ImportController {
  constructor(private readonly service: ImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, _file, cb) =>
          cb(null, `ezmoney-${Date.now()}-${Math.round(Math.random() * 1e6)}.pdf`),
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded (use form field "file").');
    }
    return this.service.importPdf(file.path);
  }
}
