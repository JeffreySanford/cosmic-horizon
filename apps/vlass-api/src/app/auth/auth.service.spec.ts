import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmailAndPassword: jest.Mock;
    findOne: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByEmailAndPassword: jest.fn(),
      findOne: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: userRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('loginWithCredentials', () => {
    it('authenticates with normalized email', async () => {
      const user = { id: 'user-1', username: 'testuser', email: 'test@vlass.local' };
      userRepository.findByEmailAndPassword.mockResolvedValue(user);

      const result = await service.loginWithCredentials({
        email: 'TEST@VLASS.LOCAL',
        password: 'Password123!',
      });

      expect(userRepository.findByEmailAndPassword).toHaveBeenCalledWith(
        'test@vlass.local',
        'Password123!'
      );
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValue(null);

      await expect(
        service.loginWithCredentials({
          email: 'missing@vlass.local',
          password: 'invalid',
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signToken', () => {
    it('signs a token with user payload', () => {
      jwtService.sign.mockReturnValue('jwt-token');
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@vlass.local',
      };

      const token = service.signToken(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@vlass.local',
        username: 'testuser',
      });
      expect(token).toBe('jwt-token');
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no user id is provided', async () => {
      await expect(service.getCurrentUser('')).resolves.toBeNull();
    });

    it('loads the user by id', async () => {
      const user = { id: 'user-1' };
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getCurrentUser('user-1');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toBe(user);
    });
  });
});
