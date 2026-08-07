import { Controller, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ContentService } from './content.service';
import { VocabReadabilityRow } from './dto/vocab-readability-response.dto';

type VocabImportEntry = {
  lemma: string;
  reading: string;
  romaji?: string;
  gloss: string;
  pos: string;
  jlpt?: string;
  examples?: { sentence: string; reading?: string; romaji?: string; gloss: string }[];
  synonyms?: string[];
  antonyms?: string[];
};

@Controller('vocab')
export class VocabController {
  constructor(private readonly contentService: ContentService) {}

  @Get('by-known-kana')
  @UseGuards(JwtAuthGuard)
  async byKnownKana(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cap') cap?: string,
  ): Promise<VocabReadabilityRow[]> {
    const parsed = cap ? Number.parseInt(cap, 10) : 200;
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 200)) : 200;
    return this.contentService.findVocabByKnownKana(new Types.ObjectId(user.userId), safe);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.contentService.findVocabById(id);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async importVocab(@Body() body: { entries: VocabImportEntry[] }) {
    return this.contentService.importVocabBatch(body.entries);
  }
}
