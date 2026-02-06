import { sharedModels } from './shared-models.js';

describe('sharedModels', () => {
  it('should work', () => {
    expect(sharedModels()).toEqual('shared-models');
  });
});
