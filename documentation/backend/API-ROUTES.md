# API Routes Reference

Complete reference of all available API endpoints in Cosmic Horizons.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require JWT Bearer token authentication:

```
Authorization: Bearer <jwt-token>
```

## Endpoints

### Authentication

#### POST /auth/register

Register a new user account.

- **Body**: `{ email, password, username }`
- **Response**: `{ id, email, username, createdAt }`

#### POST /auth/login

Login with email and password.

- **Body**: `{ email, password }`
- **Response**: `{ accessToken, refreshToken, user }`

#### POST /auth/refresh

Refresh JWT token.

- **Body**: `{ refreshToken }`
- **Response**: `{ accessToken }`

#### POST /auth/logout

Logout current user.

- **Response**: `{ message: "Logged out successfully" }`

#### GET /auth/github

GitHub OAuth login (redirects to GitHub).

#### GET /auth/github/callback

GitHub OAuth callback (handled automatically).

### Users

#### GET /users/:id

Get user profile.

- **Params**: `id` (user ID)
- **Auth**: Required
- **Response**: `{ id, email, username, profile, createdAt }`

#### PUT /users/:id

Update user profile.

- **Params**: `id` (user ID)
- **Body**: `{ username, profile, preferences }`
- **Auth**: Required
- **Response**: `{ id, email, username, profile }`

#### GET /users/:id/posts

Get user's posts.

- **Params**: `id` (user ID)  
- **Query**: `page`, `limit`
- **Response**: `{ items: Post[], total, page, limit }`

### Posts

#### GET /posts

List all posts.

- **Query**: `page` (default: 1), `limit` (default: 20), `search`
- **Response**: `{ items: Post[], total, page, limit }`

#### POST /posts

Create a new post.

- **Body**: `{ title, content, tags }`
- **Auth**: Required
- **Response**: `{ id, title, content, author, createdAt }`

#### GET /posts/:id

Get single post.

- **Params**: `id` (post ID)
- **Response**: Full post object with author and comments

#### PUT /posts/:id

Update post.

- **Params**: `id` (post ID)
- **Body**: `{ title, content, tags }`
- **Auth**: Required (owner only)
- **Response**: Updated post object

#### DELETE /posts/:id

Delete post.

- **Params**: `id` (post ID)
- **Auth**: Required (owner only)
- **Response**: `{ message: "Post deleted" }`

### Comments

#### GET /posts/:postId/comments

Get post comments.

- **Params**: `postId`
- **Query**: `page`, `limit`
- **Response**: `{ items: Comment[], total }`

#### POST /posts/:postId/comments

Create comment on post.

- **Params**: `postId`
- **Body**: `{ content }`
- **Auth**: Required
- **Response**: Comment object

#### PUT /comments/:id

Update comment.

- **Params**: `id` (comment ID)
- **Body**: `{ content }`
- **Auth**: Required (author only)
- **Response**: Updated comment

#### DELETE /comments/:id

Delete comment.

- **Params**: `id` (comment ID)
- **Auth**: Required (author or post owner)
- **Response**: `{ message: "Comment deleted" }`

### Jobs (TACC Integration)

#### GET /jobs

List all jobs.

- **Query**: `page`, `limit`, `status`, `userId`
- **Response**: `{ items: Job[], total }`

#### POST /jobs

Submit a new job.

- **Body**: `{ name, description, parameters, type }`
- **Auth**: Required
- **Response**: `{ jobId, status, createdAt }`

#### GET /jobs/:jobId

Get job status and details.

- **Params**: `jobId`
- **Auth**: Required
- **Response**: Job object with logs and status

#### DELETE /jobs/:jobId

Cancel running job.

- **Params**: `jobId`
- **Auth**: Required (owner or admin)
- **Response**: `{ message: "Job cancelled" }`

### Ephemeris & Astronomy

#### POST /ephemeris/position

Calculate celestial object position.

- **Body**: `{ objectName, ra, dec, time }`
- **Response**: `{ ra, dec, altitude, azimuth, visibility }`

#### GET /ephemeris/objects

List available objects for calculation.

- **Response**: `{ objects: string[] }`

### Logging & Monitoring

#### GET /logs

Admin-only access to system logs.

- **Query**: `level`, `service`, `limit`
- **Auth**: Required (admin only)
- **Response**: `{ items: LogEntry[], total }`

## Rate Limiting

- Default: 100 requests per minute
- Authenticated users: 1000 requests per minute
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "BadRequest"
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## WebSocket (Real-time)

### Connection

```
ws://localhost:3000/api/ws
```

### Messages

#### Subscribe to Job Updates

```json
{
  "type": "subscribe",
  "channel": "jobs",
  "jobId": "job-123"
}
```

#### Job Status Update

```json
{
  "type": "job-status",
  "jobId": "job-123",
  "status": "completed",
  "progress": 100
}
```

## Migration & Version History

### v1.0.0 (Current)

- Initial API release
- GitHub OAuth integration
- TACC job submission
- Real-time job status via WebSocket

---

For interactive API exploration, visit the **Swagger UI** at `/api/docs`.
