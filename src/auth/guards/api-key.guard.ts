import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-library-api-key'];
    const secureKey = this.configService.get<string>('STATIC_API_KEY');

    if (!apiKey || apiKey !== secureKey) {
      throw new UnauthorizedException(
        'Invalid or missing X-Library-API-Key header',
      );
    }

    return true;
  }
}
