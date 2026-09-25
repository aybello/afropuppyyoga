type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

function SvgIcon({ children, size = 20, className, strokeWidth = 2, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m6 9 6 6 6-6" /></SvgIcon>;
}

export function MenuIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></SvgIcon>;
}

export function CloseIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M18 6 6 18M6 6l12 12" /></SvgIcon>;
}

export function ArrowUpIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m5 12 7-7 7 7M12 19V5" /></SvgIcon>;
}

export function HeartIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" /></SvgIcon>;
}

export function SparkleIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m12 3-1.6 5.4L5 10l5.4 1.6L12 17l1.6-5.4L19 10l-5.4-1.6L12 3ZM5 16l-.7 2.3L2 19l2.3.7L5 22l.7-2.3L8 19l-2.3-.7L5 16Z" /></SvgIcon>;
}
