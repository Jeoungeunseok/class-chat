'use client';

import { useCallback, useEffect, useRef } from 'react';

// 스크롤 영역이 맨 아래에 있을 때만 새 메시지를 따라 내려감
// (위로 올려서 이전 대화를 읽는 중이면 화면을 끌어내리지 않음)
export function useStickToBottom<T extends HTMLElement>(changeKey: string) {
  const ref = useRef<T>(null);
  const atBottomRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [changeKey, scrollToBottom]);

  return { ref, onScroll, scrollToBottom };
}
