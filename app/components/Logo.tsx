import Image from 'next/image';

type LogoProps = {
  variant?: 'icon' | 'wordmark'; // icon = logo-only, wordmark = logo + text
  size?: 'small' | 'medium' | 'large';
  className?: string;
};

const sizeMap = {
  small: { width: 40, height: 40 },
  medium: { width: 64, height: 64 },
  large: { width: 100, height: 100 },
};

export default function Logo({ variant = 'icon', size = 'medium', className = '' }: LogoProps) {
  const dimensions = sizeMap[size];
  const src = variant === 'wordmark' ? '/logo-wordmark.png' : '/logo-icon.png';
  const alt = variant === 'wordmark' ? 'Sherbing Logo' : 'Sherbing Icon';

  return (
    <Image
      src={src}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      priority
      className={className}
    />
  );
}
