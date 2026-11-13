'use client';

import { Download, FileText } from 'lucide-react';
import { formatFileSize, getFileDownloadUrl } from '@/lib/files';

interface FileCardProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  // 강사 말풍선(진한 배경) 위에 표시할 때 true
  onDark?: boolean;
}

export function FileCard({ filePath, fileName, fileSize, onDark = false }: FileCardProps) {
  const url = getFileDownloadUrl(filePath, fileName);

  return (
    <a
      href={url}
      download={fileName}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 min-w-0 max-w-full transition border ${
        onDark
          ? 'bg-white/15 border-white/25 hover:bg-white/25 text-white'
          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-800'
      }`}
      title={`${fileName} 다운로드`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          onDark ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'
        }`}
      >
        <FileText className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{fileName}</p>
        <p className={`text-[11px] ${onDark ? 'text-white/75' : 'text-slate-500'}`}>
          {formatFileSize(fileSize)}
          {fileSize ? ' · ' : ''}눌러서 다운로드
        </p>
      </div>
      <Download className={`w-4 h-4 shrink-0 ${onDark ? 'text-white' : 'text-indigo-600'}`} />
    </a>
  );
}
