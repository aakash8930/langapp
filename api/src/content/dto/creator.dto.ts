import { IsString, IsNotEmpty, IsArray, IsNumber, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class ItemRefDto {
  @IsEnum(['vocab', 'grammar', 'kanji', 'kana', 'lesson'])
  kind: 'vocab' | 'grammar' | 'kanji' | 'kana' | 'lesson';

  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsNumber()
  order: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemRefDto)
  itemRefs: ItemRefDto[];

  @IsArray()
  @IsString({ each: true })
  exerciseTypes: string[];

  @IsArray()
  @IsString({ each: true })
  prerequisiteLessonIds: string[];
}

export class CreateVocabDto {
  @IsString()
  @IsNotEmpty()
  lemma: string;

  @IsString()
  @IsNotEmpty()
  reading: string;

  @IsString()
  @IsNotEmpty()
  romaji: string;

  @IsString()
  @IsNotEmpty()
  gloss: string;

  @IsString()
  pos: string;

  @IsEnum(['N5', 'N4', 'N3', 'N2', 'N1'])
  @IsOptional()
  jlpt?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
