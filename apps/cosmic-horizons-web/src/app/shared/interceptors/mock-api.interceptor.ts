import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockModeService } from '../../services/mock-mode.service';

interface MockUser {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: 'user' | 'admin' | 'moderator';
}

interface MockPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  hidden_at?: string | null;
  locked_at?: string | null;
  user?: MockUser;
}

interface MockComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  hidden_at: string | null;
}

interface MockReport {
  id: string;
  comment_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

interface MockDiscovery {
  id: string;
  title: string;
  body?: string;
  author?: string;
  tags?: string[];
  createdAt: string;
  hidden: boolean;
}

@Injectable()
export class MockApiInterceptor implements HttpInterceptor {
  private jobCounter = 0;
  private readonly users: MockUser[] = [
    {
      id: 'user-test-1',
      username: 'testuser',
      display_name: 'Test User',
      email: 'test@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-admin-1',
      username: 'adminuser',
      display_name: 'Admin User',
      email: 'admin@cosmic.local',
      role: 'admin',
    },
    {
      id: 'user-mod-1',
      username: 'moduser',
      display_name: 'Moderator User',
      email: 'moderator@cosmic.local',
      role: 'moderator',
    },
    {
      id: 'user-science-1',
      username: 'elena.park',
      display_name: 'Elena Park',
      email: 'elena@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-2',
      username: 'r.iqbal',
      display_name: 'R. Iqbal',
      email: 'riqbal@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-3',
      username: 'm.torres',
      display_name: 'M. Torres',
      email: 'mtorres@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-4',
      username: 'anika.shah',
      display_name: 'Anika Shah',
      email: 'anika@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-5',
      username: 'd.alvarez',
      display_name: 'D. Alvarez',
      email: 'dalvarez@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-6',
      username: 'h.nguyen',
      display_name: 'H. Nguyen',
      email: 'hnguyen@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-7',
      username: 'k.patel',
      display_name: 'K. Patel',
      email: 'kpatel@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-8',
      username: 'l.kim',
      display_name: 'L. Kim',
      email: 'lkim@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-9',
      username: 'n.rossi',
      display_name: 'N. Rossi',
      email: 'nrossi@cosmic.local',
      role: 'user',
    },
    {
      id: 'user-science-10',
      username: 'model.ops',
      display_name: 'Model Ops',
      email: 'modelops@cosmic.local',
      role: 'user',
    },
  ];
  private posts: MockPost[] = [];
  private comments: MockComment[] = [];
  private reports: MockReport[] = [];
  private discoveries: MockDiscovery[] = [];
  private initialized = false;
  private mode = inject(MockModeService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!this.mode.isMock) {
      return next.handle(req);
    }
    this.ensureSeeded();

    const path = this.extractPath(req.url);

    if (req.method === 'GET' && path === '/api/posts/published') {
      const currentUser = this.getCurrentUser();
      const canModerate =
        currentUser.role === 'admin' || currentUser.role === 'moderator';
      const visible = canModerate
        ? this.posts
        : this.posts.filter(
            (post) =>
              post.status === 'published' || post.user_id === currentUser.id,
          );
      const hydrated = visible.map((post) => this.withPostUser(post));
      return this.jsonResponse(
        hydrated.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      );
    }

    if (req.method === 'GET' && /^\/api\/posts\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').pop() || '');
      const post = this.posts.find((p) => p.id === id);
      if (!post) {
        return this.jsonResponse({ message: 'Post not found.' }, 404);
      }
      return this.jsonResponse(this.withPostUser(post));
    }

    if (req.method === 'POST' && path === '/api/posts') {
      const body = this.objectBody(req);
      const currentUser = this.getCurrentUser();
      const now = new Date().toISOString();
      const post: MockPost = {
        id: `post-${Date.now()}`,
        user_id: currentUser.id,
        title: String(body['title'] || 'Untitled draft'),
        content: String(body['content'] || ''),
        status: 'draft',
        published_at: null,
        created_at: now,
        updated_at: now,
        hidden_at: null,
        locked_at: null,
      };
      this.posts.unshift(post);
      return this.jsonResponse(this.withPostUser(post), 201);
    }

    if (req.method === 'PUT' && /^\/api\/posts\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').pop() || '');
      const body = this.objectBody(req);
      const post = this.posts.find((p) => p.id === id);
      if (!post) {
        return this.jsonResponse({ message: 'Post not found.' }, 404);
      }
      post.title = String(body['title'] || post.title);
      post.content = String(body['content'] || post.content);
      post.updated_at = new Date().toISOString();
      return this.jsonResponse(this.withPostUser(post));
    }

    if (req.method === 'POST' && /^\/api\/posts\/[^/]+\/publish$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updatePostState(id, (post) => {
        post.status = 'published';
        post.published_at = post.published_at || new Date().toISOString();
      });
    }

    if (req.method === 'POST' && /^\/api\/posts\/[^/]+\/hide$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updatePostState(id, (post) => {
        post.hidden_at = new Date().toISOString();
      });
    }

    if (req.method === 'POST' && /^\/api\/posts\/[^/]+\/unhide$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updatePostState(id, (post) => {
        post.hidden_at = null;
      });
    }

    if (req.method === 'POST' && /^\/api\/posts\/[^/]+\/lock$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updatePostState(id, (post) => {
        post.locked_at = new Date().toISOString();
      });
    }

    if (req.method === 'POST' && /^\/api\/posts\/[^/]+\/unlock$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updatePostState(id, (post) => {
        post.locked_at = null;
      });
    }

    if (req.method === 'GET' && /^\/api\/comments\/post\/[^/]+$/.test(path)) {
      const postId = decodeURIComponent(path.split('/').pop() || '');
      const rows = this.comments
        .filter((comment) => comment.post_id === postId && !comment.deleted_at)
        .map((comment) => this.withCommentUser(comment));
      return this.jsonResponse(rows);
    }

    if (req.method === 'POST' && path === '/api/comments') {
      const body = this.objectBody(req);
      const currentUser = this.getCurrentUser();
      const now = new Date().toISOString();
      const comment: MockComment = {
        id: `comment-${Date.now()}`,
        post_id: String(body['post_id'] || ''),
        user_id: currentUser.id,
        parent_id: body['parent_id'] ? String(body['parent_id']) : null,
        content: String(body['content'] || ''),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        hidden_at: null,
      };
      this.comments.push(comment);
      return this.jsonResponse(this.withCommentUser(comment), 201);
    }

    if (req.method === 'PUT' && /^\/api\/comments\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').pop() || '');
      const body = this.objectBody(req);
      const comment = this.comments.find((c) => c.id === id);
      if (!comment) {
        return this.jsonResponse({ message: 'Comment not found.' }, 404);
      }
      comment.content = String(body['content'] || comment.content);
      comment.updated_at = new Date().toISOString();
      return this.jsonResponse(this.withCommentUser(comment));
    }

    if (req.method === 'DELETE' && /^\/api\/comments\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').pop() || '');
      const comment = this.comments.find((c) => c.id === id);
      if (!comment) {
        return this.jsonResponse({ message: 'Comment not found.' }, 404);
      }
      comment.deleted_at = new Date().toISOString();
      return this.jsonResponse({ success: true });
    }

    if (req.method === 'POST' && /^\/api\/comments\/[^/]+\/report$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      const body = this.objectBody(req);
      const currentUser = this.getCurrentUser();
      const report: MockReport = {
        id: `report-${Date.now()}`,
        comment_id: id,
        user_id: currentUser.id,
        reason: String(body['reason'] || 'other'),
        description: body['description'] ? String(body['description']) : null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      this.reports.unshift(report);
      return this.jsonResponse(report, 201);
    }

    if (req.method === 'PATCH' && /^\/api\/comments\/[^/]+\/hide$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updateCommentState(id, (comment) => {
        comment.hidden_at = new Date().toISOString();
      });
    }

    if (req.method === 'PATCH' && /^\/api\/comments\/[^/]+\/unhide$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[3] || '');
      return this.updateCommentState(id, (comment) => {
        comment.hidden_at = null;
      });
    }

    if (req.method === 'GET' && path === '/api/comments/reports/all') {
      const rows = this.reports.map((report) => this.withReportRelations(report));
      return this.jsonResponse(rows);
    }

    if (
      req.method === 'PATCH' &&
      /^\/api\/comments\/reports\/[^/]+\/resolve$/.test(path)
    ) {
      const id = decodeURIComponent(path.split('/')[4] || '');
      const body = this.objectBody(req);
      const report = this.reports.find((r) => r.id === id);
      if (!report) {
        return this.jsonResponse({ message: 'Report not found.' }, 404);
      }
      const requested = String(body['status'] || 'reviewed');
      report.status = requested === 'dismissed' ? 'dismissed' : 'reviewed';
      return this.jsonResponse(this.withReportRelations(report));
    }

    if (req.method === 'GET' && path === '/api/community/feed') {
      const visible = this.discoveries
        .filter((d) => !d.hidden)
        .map((d) => ({
          id: d.id,
          title: d.title,
          body: d.body,
          author: d.author,
          tags: d.tags,
          createdAt: d.createdAt,
        }));
      return this.jsonResponse(visible);
    }

    if (req.method === 'GET' && path === '/api/community/posts/pending') {
      const pending = this.discoveries
        .filter((d) => d.hidden)
        .map((d) => ({
          id: d.id,
          title: d.title,
          body: d.body,
          author: d.author,
          tags: d.tags,
          createdAt: d.createdAt,
        }));
      return this.jsonResponse(pending);
    }

    if (req.method === 'POST' && path === '/api/community/posts') {
      const body = this.objectBody(req);
      const forceHidden = req.params.get('forceHidden') === 'true';
      const discovery: MockDiscovery = {
        id: `disc-${Date.now()}`,
        title: String(body['title'] || 'Untitled discovery'),
        body: body['body'] ? String(body['body']) : '',
        author: body['author']
          ? String(body['author'])
          : this.getCurrentUser().username,
        tags: Array.isArray(body['tags']) ? body['tags'].map(String) : [],
        createdAt: new Date().toISOString(),
        hidden: forceHidden,
      };
      this.discoveries.unshift(discovery);
      return this.jsonResponse(
        {
          id: discovery.id,
          title: discovery.title,
          body: discovery.body,
          author: discovery.author,
          tags: discovery.tags,
          createdAt: discovery.createdAt,
        },
        201,
      );
    }

    if (
      req.method === 'PATCH' &&
      /^\/api\/community\/posts\/[^/]+\/approve$/.test(path)
    ) {
      const id = decodeURIComponent(path.split('/')[4] || '');
      const target = this.discoveries.find((d) => d.id === id);
      if (!target) {
        return this.jsonResponse({ message: 'Post not found.' }, 404);
      }
      target.hidden = false;
      return this.jsonResponse({ success: true });
    }

    if (req.method === 'PATCH' && /^\/api\/community\/posts\/[^/]+\/hide$/.test(path)) {
      const id = decodeURIComponent(path.split('/')[4] || '');
      const target = this.discoveries.find((d) => d.id === id);
      if (!target) {
        return this.jsonResponse({ message: 'Post not found.' }, 404);
      }
      target.hidden = true;
      return this.jsonResponse({ success: true });
    }

    if (req.url.includes('/api/jobs/submit') && req.method === 'POST') {
      this.jobCounter++;
      const jobId = `JOB-${Date.now()}-${this.jobCounter}`;
      return this.jsonResponse({ jobId }, 200, 500);
    }

    if (req.url.includes('/api/jobs/status/') && req.method === 'GET') {
      const jobId = req.url.split('/').pop();
      const statuses: Array<'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'> = [
        'QUEUED',
        'RUNNING',
        'COMPLETED',
        'FAILED',
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      return this.jsonResponse(
        {
          id: jobId,
          status: randomStatus,
          progress: Math.random() * 100,
          output_url:
            randomStatus === 'COMPLETED'
              ? `https://tacc.utexas.edu/results/${jobId}`
              : undefined,
        },
        200,
        300,
      );
    }

    return next.handle(req);
  }

  private ensureSeeded(): void {
    if (this.initialized) {
      return;
    }

    const now = Date.now();
    const testUser = this.users.find((u) => u.username === 'testuser');
    const adminUser = this.users.find((u) => u.username === 'adminuser');
    if (!testUser || !adminUser) {
      return;
    }

    const postAuthors = [
      testUser.id,
      adminUser.id,
      'user-science-1',
      'user-science-2',
      'user-science-3',
      'user-science-4',
      'user-science-5',
      'user-science-6',
      'user-science-7',
      'user-science-8',
      'user-science-9',
      'user-science-10',
    ];
    const seedPosts: Array<{
      title: string;
      content: string;
      status: 'draft' | 'published';
      hoursAgo: number;
    }> = [
      {
        title: 'ngVLA calibration checkpoint: Band 6 pass',
        content:
          'Direction-dependent calibration pass completed with residual phase drift below threshold across 94 percent of baselines.',
        status: 'published',
        hoursAgo: 2,
      },
      {
        title: 'Transient anomaly candidate in hyperspectral cube',
        content:
          'Detected candidate transient near RA 12h17m. Cross-validating anomaly score against archival VLASS cutouts before publication.',
        status: 'draft',
        hoursAgo: 4,
      },
      {
        title: 'Array telemetry baseline from broker comparison',
        content:
          'Kafka and RabbitMQ ingest trends remained stable over 12-hour replay. Publishing baseline for team review.',
        status: 'published',
        hoursAgo: 6,
      },
      {
        title: 'Operations bulletin: moderation queue tuning',
        content:
          'Admin bulletin on policy tuning and queue triage procedure for rising community traffic during symposium prep.',
        status: 'published',
        hoursAgo: 8,
      },
      {
        title: 'FRB follow-up processing runbook',
        content:
          'Documented trigger-to-reprocess workflow for FRB candidates, including data validation checkpoints and alerting paths.',
        status: 'published',
        hoursAgo: 10,
      },
      {
        title: 'Gaia DR3 crossmatch confidence review',
        content:
          'Crossmatch confidence improved after applying motion-aware rejection on crowded fields.',
        status: 'published',
        hoursAgo: 12,
      },
      {
        title: 'JWST CEERS counterpart shortlist',
        content:
          'Compiled tentative radio-to-IR counterpart list for visual review and follow-up proposal candidates.',
        status: 'draft',
        hoursAgo: 14,
      },
      {
        title: 'Solar RFI masking strategy update',
        content:
          'Narrow-band solar interference masks were revised to preserve edge channel signal fidelity.',
        status: 'published',
        hoursAgo: 16,
      },
      {
        title: 'Pulsar timing residual dashboard notes',
        content:
          'Residual variance remained within expected bounds after recent timing model refresh.',
        status: 'published',
        hoursAgo: 18,
      },
      {
        title: 'Molecular cloud filament segmentation',
        content:
          'Latest segmentation run improves dense core continuity but still undersegments low-density bridges.',
        status: 'published',
        hoursAgo: 20,
      },
      {
        title: 'HI cube denoise ablation results',
        content:
          'Model variant C retained diffuse emission structure with lower artifact amplification than baseline.',
        status: 'published',
        hoursAgo: 22,
      },
      {
        title: 'Exoplanet host star radio variability pass',
        content:
          'No persistent host-star bursts detected in current stack; escalating sensitivity for next iteration.',
        status: 'draft',
        hoursAgo: 24,
      },
      {
        title: 'M87 jet morphology alignment check',
        content:
          'Morphology remains consistent with previous campaign under new weighting strategy.',
        status: 'published',
        hoursAgo: 26,
      },
      {
        title: 'GW follow-up response template',
        content:
          'Prepared rapid observer template for gravitational-wave triggers with pre-populated target parameters.',
        status: 'published',
        hoursAgo: 28,
      },
      {
        title: 'Cosmic ray artifact suppression benchmark',
        content:
          'Suppression pipeline reduced false positives in edge regions by 18 percent on validation set.',
        status: 'published',
        hoursAgo: 30,
      },
      {
        title: 'Survey completeness estimate refresh',
        content:
          'Completeness projections updated for low-SNR regions after extraction threshold tuning.',
        status: 'published',
        hoursAgo: 32,
      },
      {
        title: 'SETI candidate triage status',
        content:
          'Current narrowband candidate likely terrestrial interference pending one final replay.',
        status: 'draft',
        hoursAgo: 34,
      },
      {
        title: 'Cluster relic emission candidate log',
        content:
          'Diffuse relic-like feature detected near cluster edge; independent verification requested.',
        status: 'published',
        hoursAgo: 36,
      },
      {
        title: 'Archive growth horizon projection',
        content:
          'Updated archive trajectory aligns with 240 PB per year estimate under current ingest assumptions.',
        status: 'published',
        hoursAgo: 38,
      },
      {
        title: 'Inference drift monitor incident review',
        content:
          'One anomaly detector drifted beyond tolerance and was rolled back to previous validated weights.',
        status: 'published',
        hoursAgo: 40,
      },
    ];
    this.posts = seedPosts.map((post, index) => {
      const timestamp = new Date(now - post.hoursAgo * 60 * 60 * 1000).toISOString();
      return {
        id: `post-seed-${index + 1}`,
        user_id: postAuthors[index % postAuthors.length],
        title: post.title,
        content: post.content,
        status: post.status,
        published_at: post.status === 'published' ? timestamp : null,
        created_at: timestamp,
        updated_at: timestamp,
        hidden_at: null,
        locked_at: null,
      };
    });

    this.comments = [
      {
        id: 'comment-seed-1',
        post_id: 'post-seed-1',
        user_id: adminUser.id,
        parent_id: null,
        content:
          'Please attach the gain drift plot from the final validation run before we close this thread.',
        created_at: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
        updated_at: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
        deleted_at: null,
        hidden_at: null,
      },
      {
        id: 'comment-seed-2',
        post_id: 'post-seed-3',
        user_id: testUser.id,
        parent_id: null,
        content: 'Free crypto alerts from this link: suspicious.example.',
        created_at: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
        updated_at: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
        deleted_at: null,
        hidden_at: null,
      },
    ];

    this.reports = [
      {
        id: 'report-seed-1',
        comment_id: 'comment-seed-2',
        user_id: adminUser.id,
        reason: 'spam',
        description: 'Solicitation content unrelated to research context.',
        status: 'pending',
        created_at: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      },
    ];

    this.discoveries = [
      {
        id: 'disc-seed-1',
        title: 'ngVLA calibration checkpoint posted',
        body: 'Direction-dependent calibration run reached stable residuals across long baselines.',
        author: 'Elena Park',
        tags: ['calibration', 'ngvla', 'radio'],
        createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-2',
        title: 'FRB follow-up window identified',
        body: 'A candidate FRB event window aligns with archived sky tiles and is queued for reprocessing.',
        author: 'R. Iqbal',
        tags: ['frb', 'transients'],
        createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-3',
        title: 'Gaia DR3 crossmatch update',
        body: 'Crossmatch quality improved after outlier rejection on high proper-motion sources.',
        author: 'M. Torres',
        tags: ['gaia', 'catalog'],
        createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-4',
        title: 'JWST CEERS counterpart hints',
        body: 'Several radio detections now have tentative CEERS counterparts with low-confidence morphology matches.',
        author: 'Anika Shah',
        tags: ['jwst', 'ceers'],
        createdAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-5',
        title: 'CMB lensing region shortlist',
        body: 'Three high-priority fields were selected for stacked lensing validation.',
        author: 'D. Alvarez',
        tags: ['cmb', 'lensing'],
        createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-6',
        title: 'Solar burst contamination note',
        body: 'Short-duration solar burst interference was observed and masked during ingest.',
        author: 'H. Nguyen',
        tags: ['solar', 'rfi'],
        createdAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-7',
        title: 'Pulsar timing residual trend',
        body: 'Timing residuals remain within expected limits after clock correction rollout.',
        author: 'K. Patel',
        tags: ['pulsar', 'timing'],
        createdAt: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-8',
        title: 'Molecular cloud segmentation draft',
        body: 'Preliminary segmentation captures dense clumps but underestimates filament continuity.',
        author: 'S. Becker',
        tags: ['ism', 'segmentation'],
        createdAt: new Date(now - 1000 * 60 * 60 * 16).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-9',
        title: 'HI line cube denoise benchmark',
        body: 'The denoise model improved HI feature continuity with minimal flux suppression.',
        author: 'L. Kim',
        tags: ['hi', 'ml'],
        createdAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-10',
        title: 'Exoplanet host radio check',
        body: 'No strong host-star burst signatures were found in this pass; deeper stack planned.',
        author: 'A. Mensah',
        tags: ['exoplanet', 'radio'],
        createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-11',
        title: 'M87 jet morphology comparison',
        body: 'Jet feature alignment remains consistent with prior baseline imaging under updated weights.',
        author: 'N. Rossi',
        tags: ['m87', 'imaging'],
        createdAt: new Date(now - 1000 * 60 * 60 * 22).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-12',
        title: 'Gravitational-wave follow-up prep',
        body: 'Rapid response field templates were updated for next observing run coordination.',
        author: 'I. Farouk',
        tags: ['gw', 'alerts'],
        createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-13',
        title: 'Cosmic ray artifact filter tuning',
        body: 'Artifact classifier reduced false positives in edge regions by approximately 18 percent.',
        author: 'P. Sullivan',
        tags: ['cosmic-ray', 'quality'],
        createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-14',
        title: 'Survey completeness check',
        body: 'Completeness estimates improved in low-SNR regions after revised extraction thresholds.',
        author: 'Y. Chen',
        tags: ['survey', 'catalog'],
        createdAt: new Date(now - 1000 * 60 * 60 * 28).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-15',
        title: 'SETI candidate triage note',
        body: 'A narrowband candidate was classified as terrestrial interference after repeatability checks.',
        author: 'J. Rivera',
        tags: ['seti', 'rfi'],
        createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-16',
        title: 'Cluster relic emission candidate',
        body: 'Diffuse relic-like structure detected near cluster edge; pending independent confirmation.',
        author: 'T. Wallace',
        tags: ['clusters', 'candidate'],
        createdAt: new Date(now - 1000 * 60 * 60 * 32).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-17',
        title: 'VLASS tile stitching update',
        body: 'Seam correction reduced visible discontinuities along mosaic boundaries.',
        author: 'G. Okafor',
        tags: ['vlass', 'mosaic'],
        createdAt: new Date(now - 1000 * 60 * 60 * 34).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-18',
        title: 'Archive growth projection refresh',
        body: 'Storage projection updated using ingest trendlines and retention assumptions.',
        author: 'Platform Ops',
        tags: ['archive', 'capacity'],
        createdAt: new Date(now - 1000 * 60 * 60 * 36).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-19',
        title: 'Inference drift monitor flagged',
        body: 'One anomaly detector shows moderate drift versus baseline validation set.',
        author: 'Model Ops',
        tags: ['inference', 'drift'],
        createdAt: new Date(now - 1000 * 60 * 60 * 38).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-20',
        title: 'Symposium 2026 abstract reminder',
        body: 'Cosmic Horizons Conference abstract deadline is April 1, 2026. Draft submissions are now open.',
        author: 'announcements',
        tags: ['symposium', 'deadline'],
        createdAt: new Date(now - 1000 * 60 * 60 * 40).toISOString(),
        hidden: false,
      },
      {
        id: 'disc-seed-21',
        title: 'Pending moderation example: citation dispute',
        body: 'This seeded discovery remains hidden until moderator review completes.',
        author: 'adminuser',
        tags: ['moderation'],
        createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
        hidden: true,
      },
      {
        id: 'disc-seed-22',
        title: 'Pending moderation example: duplicate claim',
        body: 'Second hidden sample item used to validate admin moderation actions.',
        author: 'moduser',
        tags: ['moderation'],
        createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
        hidden: true,
      },
    ];

    this.initialized = true;
  }

  private withPostUser(post: MockPost): MockPost {
    const user = this.users.find((u) => u.id === post.user_id);
    return {
      ...post,
      user,
    };
  }

  private withCommentUser(comment: MockComment): MockComment & { user?: MockUser } {
    return {
      ...comment,
      user: this.users.find((u) => u.id === comment.user_id),
    };
  }

  private withReportRelations(report: MockReport) {
    const comment = this.comments.find((c) => c.id === report.comment_id);
    return {
      ...report,
      user: this.users.find((u) => u.id === report.user_id),
      comment: comment ? this.withCommentUser(comment) : undefined,
    };
  }

  private updatePostState(
    id: string,
    updater: (post: MockPost) => void,
  ): Observable<HttpEvent<unknown>> {
    const post = this.posts.find((p) => p.id === id);
    if (!post) {
      return this.jsonResponse({ message: 'Post not found.' }, 404);
    }
    updater(post);
    post.updated_at = new Date().toISOString();
    return this.jsonResponse(this.withPostUser(post));
  }

  private updateCommentState(
    id: string,
    updater: (comment: MockComment) => void,
  ): Observable<HttpEvent<unknown>> {
    const comment = this.comments.find((c) => c.id === id);
    if (!comment) {
      return this.jsonResponse({ message: 'Comment not found.' }, 404);
    }
    updater(comment);
    comment.updated_at = new Date().toISOString();
    return this.jsonResponse(this.withCommentUser(comment));
  }

  private getCurrentUser(): MockUser {
    if (typeof window === 'undefined') {
      return this.users[0];
    }

    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        return this.users[0];
      }
      const user = JSON.parse(raw) as { id?: unknown; username?: unknown };
      if (typeof user.id === 'string') {
        const byId = this.users.find((candidate) => candidate.id === user.id);
        if (byId) {
          return byId;
        }
      }
      if (typeof user.username === 'string') {
        const byUsername = this.users.find(
          (candidate) => candidate.username === user.username,
        );
        if (byUsername) {
          return byUsername;
        }
      }
    } catch {
      return this.users[0];
    }

    return this.users[0];
  }

  private objectBody(req: HttpRequest<unknown>): Record<string, unknown> {
    if (!req.body || typeof req.body !== 'object') {
      return {};
    }
    return req.body as Record<string, unknown>;
  }

  private extractPath(url: string): string {
    try {
      return new URL(url, 'http://localhost').pathname;
    } catch {
      return url;
    }
  }

  private jsonResponse(
    body: unknown,
    status = 200,
    latencyMs = 180,
  ): Observable<HttpEvent<unknown>> {
    return of(
      new HttpResponse({
        status,
        body,
      }),
    ).pipe(delay(latencyMs));
  }
}
