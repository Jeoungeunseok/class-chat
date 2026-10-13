'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  pinCode: string;
  sessionId: string;
  isProjectorMode?: boolean;
}

export function QRCodeDisplay({ pinCode, isProjectorMode = false }: QRCodeDisplayProps) {
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = `${origin}/?pin=${pinCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-xl border border-gray-100 ${
        isProjectorMode ? 'p-10 scale-105' : ''
      }`}
    >
      <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
        수업 참여 QR 코드
      </div>

      <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-200">
        <QRCodeSVG
          value={joinUrl}
          size={isProjectorMode ? 280 : 180}
          level="H"
          includeMargin={true}
        />
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs text-gray-500 font-medium">카메라로 QR 스캔 또는 참여코드 입력</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-3xl font-black tracking-widest text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-lg border border-indigo-200">
            {pinCode}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 w-full max-w-xs">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨!' : '초대 링크 복사'}
        </button>
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center p-2 text-gray-500 hover:text-indigo-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          title="새 창으로 열기"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
