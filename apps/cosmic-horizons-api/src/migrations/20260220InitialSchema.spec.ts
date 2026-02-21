import { InitialSchema20260220 } from './20260220InitialSchema';

describe('InitialSchema20260220 migration', () => {
  const migration = new InitialSchema20260220();
  const mockRunner: any = {
    query: jest.fn().mockResolvedValue(undefined),
  };

  it('up does not throw', async () => {
    await expect(migration.up(mockRunner)).resolves.not.toThrow();
    expect(mockRunner.query).toHaveBeenCalled();
  });
  it('down does not throw', async () => {
    await expect(migration.down(mockRunner)).resolves.not.toThrow();
    expect(mockRunner.query).toHaveBeenCalled();
  });
});
