interface LogoProps {
  className?: string
}

/**
 * Six sides for "Six Man," with a basketball-seam curve through it. Uses
 * currentColor for the hexagon so it inherits whatever text color the
 * surrounding theme (dark app chrome, light home page) already sets; the
 * seam is always drawn in the basketball-orange accent.
 */
export function Logo({ className = 'w-5 h-5' }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 1.5 L21.09 6.75 V17.25 L12 22.5 L2.91 17.25 V6.75 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 8.5 C 9 11, 15 11, 20 8.5"
        stroke="#E8590C"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
