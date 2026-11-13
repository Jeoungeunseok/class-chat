import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FILE_BUCKET } from './files';

// 강사 자료 파일 저장소 (Supabase Storage)
// 업로드 권한 발급·삭제는 서버 전용 service role 키로만 수행 → 학생은 업로드 불가, 다운로드만 가능
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (Supabase 무료 플랜 업로드 한도)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient: SupabaseClient | null =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

export const isFileStorageConfigured = Boolean(adminClient);

let bucketReady: Promise<void> | null = null;

// 버킷이 없으면 공개(다운로드 전용) 버킷으로 자동 생성
function ensureBucket(client: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await client.storage.getBucket(FILE_BUCKET);
      if (data) return;
      const { error } = await client.storage.createBucket(FILE_BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (error && !/already exists/i.test(error.message)) {
        throw error;
      }
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  return bucketReady;
}

// 한글 등 원본 파일명은 DB에 보관하고, 저장 경로는 안전한 영문 키로 생성
function buildObjectPath(sessionId: string, fileName: string): string {
  const ext = (fileName.match(/\.([A-Za-z0-9]{1,10})$/)?.[1] || 'bin').toLowerCase();
  const random = Math.random().toString(36).slice(2, 10);
  return `${sessionId}/${Date.now()}_${random}.${ext}`;
}

export function isValidSessionFilePath(sessionId: string, path: string): boolean {
  return (
    typeof path === 'string' &&
    path.startsWith(`${sessionId}/`) &&
    !path.includes('..') &&
    /^[A-Za-z0-9_\-/.]+$/.test(path)
  );
}

// 브라우저가 Supabase에 직접 업로드할 수 있는 1회용 업로드 토큰 발급 (Vercel 4.5MB 제한 회피)
export async function createUploadTicket(
  sessionId: string,
  fileName: string
): Promise<{ path: string; token: string }> {
  if (!adminClient) {
    throw new Error('파일 업로드 설정이 되어 있지 않습니다 (SUPABASE_SERVICE_ROLE_KEY 필요).');
  }
  await ensureBucket(adminClient);
  const path = buildObjectPath(sessionId, fileName);
  const { data, error } = await adminClient.storage.from(FILE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message || '업로드 URL 발급에 실패했습니다.');
  }
  return { path: data.path, token: data.token };
}

export async function removeFiles(paths: string[]): Promise<void> {
  if (!adminClient || paths.length === 0) return;
  const { error } = await adminClient.storage.from(FILE_BUCKET).remove(paths);
  if (error) console.error('Failed to remove files:', error);
}

// 수업 종료/새 수업 시작 시 저장된 모든 자료 삭제
export async function removeAllFiles(): Promise<void> {
  if (!adminClient) return;
  try {
    const bucket = adminClient.storage.from(FILE_BUCKET);
    const { data: folders, error } = await bucket.list('', { limit: 1000 });
    if (error || !folders) return;

    for (const folder of folders) {
      const { data: files } = await bucket.list(folder.name, { limit: 1000 });
      const paths = (files || []).map((f) => `${folder.name}/${f.name}`);
      await removeFiles(paths);
    }
  } catch (e) {
    console.error('Failed to remove all files:', e);
  }
}
