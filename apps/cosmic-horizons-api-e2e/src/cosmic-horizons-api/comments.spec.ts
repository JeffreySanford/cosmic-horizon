import axios from 'axios';

describe('comments e2e', () => {
  let authToken: string;
  let postId: string;

  beforeAll(async () => {
    // Login as test user
    const loginRes = await axios.post('/api/auth/login', {
      email: 'test@cosmic.local',
      password: 'Password123!',
    });
    authToken = loginRes.data.access_token;

    // Create a post to comment on
    const postRes = await axios.post(
      '/api/posts',
      {
        title: 'Comment Test Post',
        content: 'Post for testing comments.',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    postId = postRes.data.id;

    // Publish it
    await axios.post(
      `/api/posts/${postId}/publish`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
  });

  it('POST /api/comments creates a new comment', async () => {
    const response = await axios.post(
      '/api/comments',
      {
        post_id: postId,
        content: 'This is a test comment.',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    expect(response.status).toBe(201);
    expect(response.data.content).toBe('This is a test comment.');
    expect(response.data.post_id).toBe(postId);
  });

  it('POST /api/comments creates a reply to a comment', async () => {
    // First, create a parent comment
    const parentRes = await axios.post(
      '/api/comments',
      {
        post_id: postId,
        content: 'Parent comment',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const parentId = parentRes.data.id;

    // Now reply to it
    const replyRes = await axios.post(
      '/api/comments',
      {
        post_id: postId,
        parent_id: parentId,
        content: 'This is a reply.',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    expect(replyRes.status).toBe(201);
    expect(replyRes.data.parent_id).toBe(parentId);
    expect(replyRes.data.content).toBe('This is a reply.');
  });

  it('GET /api/comments/post/:postId returns all comments for a post', async () => {
    const response = await axios.get(`/api/comments/post/${postId}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThanOrEqual(2);
  });

  it('PUT /api/comments/:id updates a comment', async () => {
    const createRes = await axios.post(
      '/api/comments',
      {
        post_id: postId,
        content: 'Update me',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const commentId = createRes.data.id;

    const updateRes = await axios.put(
      `/api/comments/${commentId}`,
      { content: 'I am updated' },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    expect(updateRes.status).toBe(200);
    expect(updateRes.data.content).toBe('I am updated');
  });

  it('DELETE /api/comments/:id removes a comment', async () => {
    const createRes = await axios.post(
      '/api/comments',
      {
        post_id: postId,
        content: 'Delete me',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const commentId = createRes.data.id;

    const deleteRes = await axios.delete(`/api/comments/${commentId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(deleteRes.status).toBe(204);

    const checkRes = await axios.get(`/api/comments/post/${postId}`);
    const deletedFound = (checkRes.data as Array<{ id: string }>).find(
      (c) => c.id === commentId,
    );
    expect(deletedFound).toBeUndefined();
  });
});
