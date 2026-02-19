import {
  Test,
  type TestingModule,
  type TestingModuleBuilder,
} from '@nestjs/testing';

const trackedModules = new Set<TestingModule>();
const originalCreateTestingModule = Test.createTestingModule.bind(Test);

jest
  .spyOn(Test, 'createTestingModule')
  .mockImplementation(
    (metadata: Parameters<typeof Test.createTestingModule>[0]) => {
      const builder = originalCreateTestingModule(
        metadata,
      ) as TestingModuleBuilder & {
        compile: (...args: unknown[]) => Promise<TestingModule>;
      };
      const originalCompile = builder.compile.bind(builder);

      builder.compile = async (...args: unknown[]) => {
        const moduleRef = await originalCompile(...args);
        trackedModules.add(moduleRef);
        return moduleRef;
      };

      return builder;
    },
  );

afterEach(async () => {
  const modules = Array.from(trackedModules);
  trackedModules.clear();

  await Promise.all(
    modules.map(async (moduleRef) => {
      try {
        await moduleRef.close();
      } catch {
        // Ignore double-close and partially initialized module teardown failures.
      }
    }),
  );
});
