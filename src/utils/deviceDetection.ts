import { useEffect, useState } from 'react';

export function checkIsMobilePhone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrowTouch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth <= 900;

  return mobileUa || narrowTouch;
}

export function useIsMobilePhone(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobilePhone());

  useEffect(() => {
    const update = () => setIsMobile(checkIsMobilePhone());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isMobile;
}
