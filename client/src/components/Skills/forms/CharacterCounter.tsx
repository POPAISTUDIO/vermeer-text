import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Fraction of the limit at which the counter becomes visible. */
const VISIBILITY_THRESHOLD = 0.8;

interface CharacterCounterProps {
  count: number;
  max: number;
  className?: string;
}

/**
 * `used / max` character count for a text field. Stays hidden until the field
 * reaches ~80% of its limit (visual sobriety), then turns red once the limit
 * is exceeded, mirroring the field's `maxLength` validation error.
 */
export default function CharacterCounter({ count, max, className }: CharacterCounterProps) {
  const localize = useLocalize();
  if (count < max * VISIBILITY_THRESHOLD) {
    return null;
  }
  const over = count > max;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        over ? 'text-red-500' : 'text-text-secondary',
        className,
      )}
      aria-label={localize('com_ui_character_count', { 0: String(count), 1: String(max) })}
    >
      {count} / {max}
    </span>
  );
}
