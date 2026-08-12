import { NotFoundException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { UserService } from './user.service';
import { LearningService } from '../learning/learning.service';
import { ChatService } from '../chat/chat.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SocialService } from '../social/social.service';
import { PracticeService } from '../practice/practice.service';

const USER_ID = '607f1f77bcf86cd799439011';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  let userService: { findById: jest.Mock; deleteUser: jest.Mock };
  let learningService: { deleteAllForUser: jest.Mock };
  let chatService: { deleteAllForUser: jest.Mock };
  let analyticsService: { deleteAllForUser: jest.Mock };
  let socialService: { deleteAllForUser: jest.Mock };
  let practiceService: { deleteAllForUser: jest.Mock };

  beforeEach(() => {
    userService = {
      findById: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };
    learningService = {
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    chatService = {
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    analyticsService = {
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    socialService = {
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    practiceService = {
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };

    service = new AccountDeletionService(
      userService as unknown as UserService,
      learningService as unknown as LearningService,
      chatService as unknown as ChatService,
      analyticsService as unknown as AnalyticsService,
      socialService as unknown as SocialService,
      practiceService as unknown as PracticeService,
    );
  });

  it('deletes all user data across all services when user exists', async () => {
    userService.findById.mockResolvedValue({ _id: USER_ID });

    await service.deleteAccount(USER_ID);

    expect(userService.findById).toHaveBeenCalledWith(USER_ID);
    expect(learningService.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(chatService.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(analyticsService.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(socialService.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(practiceService.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(userService.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('throws NotFoundException when user does not exist without deleting data', async () => {
    userService.findById.mockResolvedValue(null);

    await expect(service.deleteAccount(USER_ID)).rejects.toThrow(NotFoundException);

    expect(learningService.deleteAllForUser).not.toHaveBeenCalled();
    expect(chatService.deleteAllForUser).not.toHaveBeenCalled();
    expect(analyticsService.deleteAllForUser).not.toHaveBeenCalled();
    expect(socialService.deleteAllForUser).not.toHaveBeenCalled();
    expect(practiceService.deleteAllForUser).not.toHaveBeenCalled();
    expect(userService.deleteUser).not.toHaveBeenCalled();
  });
});
