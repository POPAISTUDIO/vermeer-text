import { useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { useLocalize } from '~/hooks';

/**
 * Vermeer — bandeau permanent annonçant la fermeture du service (6 novembre 2026).
 * Non fermable. Remonte sa hauteur (multi-lignes en mobile) pour que `Root` la réserve.
 */
export const ClosureBanner = ({
  onHeightChange,
}: {
  onHeightChange?: (height: number) => void;
}) => {
  const localize = useLocalize();
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = bannerRef.current;
    if (!node || !onHeightChange) {
      return;
    }

    const report = () => onHeightChange(node.offsetHeight);
    report();

    const observer = new ResizeObserver(report);
    observer.observe(node);

    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange]);

  return (
    <div
      ref={bannerRef}
      role="status"
      className="flex items-start gap-2 border-b-2 border-[#E5384A] bg-surface-secondary px-4 py-2 text-sm text-text-primary md:items-center md:justify-center"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[#E5384A] md:mt-0" aria-hidden="true" />
      <p className="min-w-0 break-words">{localize('com_ui_closure_banner_message')}</p>
    </div>
  );
};
