import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmailAndPassword: jest.Mock;
    findByUsername: jest.Mock;
    findByEmail: jest.Mock;
    createWithPassword: jest.Mock;
    findOne: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };
  let dataSource: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByEmailAndPassword: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      createWithPassword: jest.fn(),
      findOne: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };
    dataSource = {
      query: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
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
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = testingModule.get<AuthService>(AuthService);
  });

  describe('loginWithCredentials', () => {
    it('authenticates with normalized email', async () => {
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
      };
      userRepository.findByEmailAndPassword.mockResolvedValue(user);

      const result = await service.loginWithCredentials({
        email: 'TEST@COSMIC.LOCAL',
        password: 'Password123!',
      });

      expect(userRepository.findByEmailAndPassword).toHaveBeenCalledWith(
        'test@cosmic.local',
        'Password123!',
      );
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValue(null);

      await expect(
        service.loginWithCredentials({
          email: 'missing@cosmic.local',
          password: 'invalid',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signToken', () => {
    it('signs a token with user payload', () => {
      jwtService.sign.mockReturnValue('jwt-token');
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
        role: 'admin',
      };

      const token = service.signToken(user as never);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@cosmic.local',
        username: 'testuser',
        role: 'admin',
      });
      expect(token).toBe('jwt-token');
    });
  });

  describe('registerWithCredentials', () => {
    it('registers a new user when username/email are available', async () => {
      const created = {
        id: 'user-2',
        username: 'newuser',
        email: 'new@cosmic.local',
        display_name: 'newuser',
      };
      userRepository.findByUsername.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.createWithPassword.mockResolvedValue(created);

      const result = await service.registerWithCredentials({
        username: 'newuser',
        email: 'NEW@COSMIC.LOCAL',
        password: 'Password123!',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith({
        username: 'newuser',
        display_name: 'newuser',
        email: 'new@cosmic.local',
        password: 'Password123!',
      });
      expect(result).toBe(created);
    });

    it('throws conflict for duplicate username', async () => {
      userRepository.findByUsername.mockResolvedValue({ id: 'existing' });

      await expect(
        service.registerWithCredentials({
          username: 'testuser',
          email: 'new@cosmic.local',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('issueAuthTokens', () => {
    it('issues access and refresh tokens', async () => {
      jwtService.sign.mockReturnValue('access-token');
      dataSource.query.mockResolvedValue(undefined);
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
        role: 'user',
      };

      const result = await service.issueAuthTokens(user as never);

      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token.length).toBeGreaterThan(30);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_refresh_tokens'),
        expect.arrayContaining([
          'user-1',
          expect.any(String),
          expect.any(String),
        ]),
      );
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
