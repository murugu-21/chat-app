import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '../utils/cnHelper';

type LoadingSpinnerProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

/**
 * Loading icon that spins
 * - To customize size, use tailwind classes and `className` prop
 * - To customize color, use tailwind classes as follows:
 *   - `border-[]` for 3/4th part of loading circle
 *   - `border-b-[]` for 1/4th part of loading circle
 */
const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'w-4 h-4 rounded-full border-[1.5px] border-[#05055233] border-b-[#050552] animate-spin',
          className
        )}
        {...props}
        ref={ref}
      />
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export { LoadingSpinner };

export type { LoadingSpinnerProps };
