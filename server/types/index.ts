import type { PrismaClient } from '@prisma/client';

export interface AuthUser {
  userId: number;
  email: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface RegisterRequestBody {
  email: string;
  password: string;
}

export interface CreateFileRequestBody {
  name: string;
  folder_id?: number | string | null;
}

export interface UpdateFileRequestBody {
  name?: string;
  content?: string;
}

export interface CreateFolderRequestBody {
  name: string;
  parent_id?: number | string | null;
}

export interface UpdateFolderRequestBody {
  name: string;
}

declare module 'h3' {
  interface H3EventContext {
    user?: AuthUser;
  }
}

declare module 'nitropack' {
  interface NitroApp {
    $prisma: PrismaClient;
  }
}
