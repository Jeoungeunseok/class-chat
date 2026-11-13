import { supabase } from './supabase';

// 클라이언트/서버 공용: 파일 다운로드 URL 및 표시용 크기
export const FILE_BUCKET = 'class-files';

export function getFileDownloadUrl(path: string, fileName: string): string {
  if (!supabase) return '#';
  return supabase.storage.from(FILE_BUCKET).getPublicUrl(path, { download: fileName }).data.publicUrl;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
