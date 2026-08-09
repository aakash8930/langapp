import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AuditService } from '../audit.service';
import { ContentService } from '../../content/content.service';
import { Course, CourseDocument } from '../../content/schemas/course.schema';
import { Quiz, QuizDocument } from '../../content/schemas/quiz.schema';
import { ContentVersion, ContentVersionDocument } from '../../content/schemas/content-version.schema';
import { Lesson, LessonDocument } from '../../content/schemas/lesson.schema';
import { VocabItem, VocabItemDocument } from '../../content/schemas/vocab-item.schema';
import { KanjiEntry, KanjiEntryDocument } from '../../content/schemas/kanji-entry.schema';
import { GrammarPoint, GrammarPointDocument } from '../../content/schemas/grammar-point.schema';
import { KanaItem, KanaItemDocument } from '../../content/schemas/kana-item.schema';
import { StorageService } from '../../common/storage/storage.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
    @InjectModel(ContentVersion.name) private readonly versionModel: Model<ContentVersionDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(VocabItem.name) private readonly vocabModel: Model<VocabItemDocument>,
    @InjectModel(KanjiEntry.name) private readonly kanjiModel: Model<KanjiEntryDocument>,
    @InjectModel(GrammarPoint.name) private readonly grammarModel: Model<GrammarPointDocument>,
    @InjectModel(KanaItem.name) private readonly kanaModel: Model<KanaItemDocument>,
  ) {}

  private async saveVersion(type: string, id: string, snapshot: Record<string, unknown>) {
    const count = await this.versionModel.countDocuments({ contentType: type, contentId: new Types.ObjectId(id) }).exec();
    await this.versionModel.create({
      contentType: type, contentId: new Types.ObjectId(id), version: count + 1, snapshot,
    });
  }

  // ---- Counts ----
  @Get('content/counts')
  async counts() {
    return {
      vocab: await this.content.countVocab(),
      kanji: await this.content.countKanji(),
      grammar: await this.content.countGrammar(),
      kana: await this.content.countKana(),
      lessons: await this.content.countLessons(),
      courses: await this.courseModel.countDocuments().exec(),
      quizzes: await this.quizModel.countDocuments().exec(),
    };
  }

  // ---- Paginated lists ----
  @Get('content/vocab/list')
  async listVocab(@Query('page') p?: string, @Query('limit') l?: string) {
    const page = Math.max(1, parseInt(p ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(l ?? '20', 10) || 20);
    const [items, total] = await Promise.all([
      this.vocabModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.vocabModel.countDocuments().exec(),
    ]);
    return { items: items.map((i) => ({ id: i._id, lemma: i.lemma, reading: i.reading, gloss: i.gloss, pos: i.pos, jlpt: i.jlpt })), total, page };
  }

  @Get('content/kanji/list')
  async listKanji(@Query('page') p?: string, @Query('limit') l?: string) {
    const page = Math.max(1, parseInt(p ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(l ?? '20', 10) || 20);
    const [items, total] = await Promise.all([
      this.kanjiModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.kanjiModel.countDocuments().exec(),
    ]);
    return { items: items.map((i) => ({ id: i._id, char: i.char, meanings: i.meanings, jlpt: i.jlpt, strokes: i.strokes })), total, page };
  }

  @Get('content/grammar/list')
  async listGrammar(@Query('page') p?: string, @Query('limit') l?: string) {
    const page = Math.max(1, parseInt(p ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(l ?? '20', 10) || 20);
    const [items, total] = await Promise.all([
      this.grammarModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.grammarModel.countDocuments().exec(),
    ]);
    return { items: items.map((i) => ({ id: i._id, title: i.title, jlpt: i.jlpt })), total, page };
  }

  @Get('content/lessons/list')
  async listLessons(@Query('page') p?: string, @Query('limit') l?: string) {
    const page = Math.max(1, parseInt(p ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(l ?? '20', 10) || 20);
    const [items, total] = await Promise.all([
      this.lessonModel.find().sort({ unit: 1, order: 1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.lessonModel.countDocuments().exec(),
    ]);
    return { items: items.map((i) => ({ id: i._id, title: i.title, unit: i.unit, order: i.order, itemCount: i.itemRefs.length })), total, page };
  }

  // ---- Real deletes ----
  @Delete('content/:type/:id')
  async deleteContent(@CurrentUser() admin: AuthenticatedUser, @Param('type') type: string, @Param('id') id: string) {
    const model = this.getModel(type);
    if (!model) throw new BadRequestException('Unknown content type');
    const doc = await model.findById(id).exec();
    if (doc) {
      await this.saveVersion(type, id, (doc as any).toObject());
      await model.findByIdAndDelete(id).exec();
    }
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.delete', resource: type, resourceId: id });
    return { deleted: true };
  }

  // ---- Version history ----
  @Get('content/:type/:id/versions')
  async getVersions(@Param('type') type: string, @Param('id') id: string) {
    const items = await this.versionModel.find({ contentType: type, contentId: new Types.ObjectId(id) }).sort({ version: -1 }).limit(20).exec();
    return items.map((v) => ({ version: v.version, createdAt: v.get('createdAt'), snapshot: v.snapshot }));
  }

  // ---- Courses ----
  @Get('courses')
  async listCourses() {
    const items = await this.courseModel.find().sort({ order: 1 }).exec();
    return { items, total: items.length };
  }

  @Post('courses')
  async createCourse(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const course = await this.courseModel.create(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'course.create', resource: 'course', resourceId: course._id.toString() });
    return course;
  }

  @Patch('courses/:id')
  async updateCourse(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    const course = await this.courseModel.findByIdAndUpdate(id, { $set: body }, { new: true }).exec();
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'course.update', resource: 'course', resourceId: id });
    return course;
  }

  // ---- Quizzes ----
  @Get('quizzes')
  async listQuizzes(@Query('page') p?: string, @Query('limit') l?: string) {
    const page = Math.max(1, parseInt(p ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(l ?? '20', 10) || 20);
    const [items, total] = await Promise.all([
      this.quizModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.quizModel.countDocuments().exec(),
    ]);
    return { items, total, page };
  }

  @Post('quizzes')
  async createQuiz(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const quiz = await this.quizModel.create(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'quiz.create', resource: 'quiz', resourceId: quiz._id.toString() });
    return quiz;
  }

  @Patch('quizzes/:id')
  async updateQuiz(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    const quiz = await this.quizModel.findByIdAndUpdate(id, { $set: body }, { new: true }).exec();
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'quiz.update', resource: 'quiz', resourceId: id });
    return quiz;
  }

  @Delete('quizzes/:id')
  async deleteQuiz(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    await this.quizModel.findByIdAndDelete(id).exec();
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'quiz.delete', resource: 'quiz', resourceId: id });
    return { deleted: true };
  }

  // ---- Audio upload ----
  @Post('media/audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAudio(@CurrentUser() admin: AuthenticatedUser, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined) {
    if (!file) throw new BadRequestException('No file');
    const key = `audio/${Date.now()}-${file.originalname}`;
    await this.storage.put(key, file.buffer);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'media.upload', resource: 'audio', details: { key } });
    return { key, size: file.buffer.length };
  }

  @Delete('media/audio/:key')
  async deleteAudio(@CurrentUser() admin: AuthenticatedUser, @Param('key') key: string) {
    await this.storage.delete(key);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'media.delete', resource: 'audio', resourceId: key });
    return { deleted: true };
  }

  // ---- Content CRUD (existing) ----
  @Post('content/vocab')
  async createVocab(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const result = await this.content.upsertVocab(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.create', resource: 'vocab', resourceId: body.lemma, details: body });
    return result;
  }

  @Post('content/grammar')
  async createGrammar(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const result = await this.content.upsertGrammar(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.create', resource: 'grammar', resourceId: body.title });
    return result;
  }

  @Post('content/kanji')
  async createKanji(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const result = await this.content.upsertKanji(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.create', resource: 'kanji', resourceId: body.char });
    return result;
  }

  @Post('content/kana')
  async createKana(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const result = await this.content.upsertKana(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.create', resource: 'kana', resourceId: body.kana });
    return result;
  }

  @Post('content/lessons')
  async createLesson(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const result = await this.content.upsertLesson(body);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.create', resource: 'lesson', resourceId: String(body.order) });
    return result;
  }

  @Post('content/vocab/import')
  async importVocab(@CurrentUser() admin: AuthenticatedUser, @Body() body: { entries: any[] }) {
    const result = await this.content.importVocabBatch(body.entries);
    await this.audit.log({ adminId: admin.userId, email: admin.email, action: 'content.import', resource: 'vocab', details: { count: body.entries.length, ...result } });
    return result;
  }

  private getModel(type: string) {
    const map: Record<string, Model<any>> = { vocab: this.vocabModel, kanji: this.kanjiModel, grammar: this.grammarModel, lesson: this.lessonModel, kana: this.kanaModel, course: this.courseModel, quiz: this.quizModel };
    return map[type] ?? null;
  }
}
