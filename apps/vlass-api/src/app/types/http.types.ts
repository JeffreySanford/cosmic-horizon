import { User } from '../entities';

export type SessionShape = {
  csrfToken?: string;
};

export type RequestUser = Partial<User> & { id: string | number };

export type RequestWithUser = {
  user?: RequestUser;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  session?: SessionShape;
  logout?: (callback: (err: Error | null) => void) => void;
};

export type AuthenticatedRequest = RequestWithUser & {
  user: RequestUser;
};

export type ResponseWithJsonAndRedirect = {
  json: (body: unknown) => void;
  redirect: (url: string) => void;
};
