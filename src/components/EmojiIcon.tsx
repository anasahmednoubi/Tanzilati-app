import React from 'react';

export type EmojiName =
  | 'check'
  | 'sparkles'
  | 'clipboard'
  | 'video'
  | 'music'
  | 'download'
  | 'cloud'
  | 'warning'
  | 'bell';

interface EmojiIconProps {
  name: EmojiName;
  size?: number;
  className?: string;
}

/**
 * Self-contained colorful vector emoji set (Twemoji / Fluent inspired).
 * Renders identically across all Android WebViews and desktop browsers with zero external CDN requests.
 */
export const EmojiIcon: React.FC<EmojiIconProps> = ({ name, size = 18, className = '' }) => {
  const uidPrefix = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const wrapStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    verticalAlign: 'middle',
  };

  switch (name) {
    case 'check': {
      const gradId = `${uidPrefix}_chk`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#${gradId})`} />
            <path
              d="M11.5 18.6L15.8 22.9L24.8 13.4"
              stroke="#FFFFFF"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    }

    case 'sparkles': {
      const gradId = `${uidPrefix}_spk`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            <path
              d="M19.5 3.5C19.8 10.2 22.8 13.2 29.5 13.5C22.8 13.8 19.8 16.8 19.5 23.5C19.2 16.8 16.2 13.8 9.5 13.5C16.2 13.2 19.2 10.2 19.5 3.5Z"
              fill={`url(#${gradId})`}
            />
            <path
              d="M9.5 19.5C9.7 23.2 11.3 24.8 15 25C11.3 25.2 9.7 26.8 9.5 30.5C9.3 26.8 7.7 25.2 4 25C7.7 24.8 9.3 23.2 9.5 19.5Z"
              fill="#FBBF24"
            />
            <circle cx="28" cy="26" r="2.6" fill="#FDE047" />
          </svg>
        </span>
      );
    }

    case 'clipboard': {
      const gradId = `${uidPrefix}_clp`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="6" y1="6" x2="30" y2="33" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="24" height="27" rx="4.5" fill={`url(#${gradId})`} />
            <rect x="9" y="10" width="18" height="20" rx="2" fill="#F8FAFC" />
            <rect x="12.5" y="3.5" width="11" height="5.5" rx="2.5" fill="#94A3B8" />
            <rect x="12" y="15" width="12" height="2.2" rx="1.1" fill="#CBD5E1" />
            <rect x="12" y="20" width="9" height="2.2" rx="1.1" fill="#CBD5E1" />
            <rect x="12" y="25" width="11" height="2.2" rx="1.1" fill="#CBD5E1" />
          </svg>
        </span>
      );
    }

    case 'video': {
      const gradId = `${uidPrefix}_vid`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="3" y1="6" x2="33" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>
            </defs>
            <rect x="3" y="6" width="30" height="24" rx="6" fill={`url(#${gradId})`} />
            <path d="M14.5 12.2L24.5 18L14.5 23.8V12.2Z" fill="#FFFFFF" />
          </svg>
        </span>
      );
    }

    case 'music': {
      const gradId = `${uidPrefix}_mus`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="30" height="30" rx="8" fill={`url(#${gradId})`} />
            <path
              d="M23.5 10.5V22.2C23.5 24.3 21.7 26 19.5 26C17.3 26 15.5 24.3 15.5 22.2C15.5 20.1 17.3 18.4 19.5 18.4C20.2 18.4 20.8 18.6 21.3 18.9V13.6L14.8 15.1V24C14.8 26.1 13 27.8 10.8 27.8C8.6 27.8 6.8 26.1 6.8 24C6.8 21.9 8.6 20.2 10.8 20.2C11.5 20.2 12.1 20.4 12.6 20.7V11.8C12.6 11.1 13.1 10.5 13.8 10.3L22.1 8.4C22.9 8.2 23.5 8.8 23.5 9.6V10.5Z"
              fill="#FFFFFF"
            />
          </svg>
        </span>
      );
    }

    case 'download': {
      const gradId = `${uidPrefix}_dl`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#0D9488" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#${gradId})`} />
            <path
              d="M18 10V21.5M13 17.2L18 22.2L23 17.2M11.5 25.5H24.5"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    }

    case 'cloud': {
      const gradId = `${uidPrefix}_cld`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="4" y1="8" x2="32" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            <path
              d="M11 27H25.5C28.8 27 31.5 24.3 31.5 21C31.5 18 29.3 15.5 26.4 15.1C25.5 11.1 21.9 8.2 17.6 8.2C12.7 8.2 8.7 12.1 8.6 17C5.9 17.6 4 20 4 22.8C4 25.2 6.1 27 11 27Z"
              fill={`url(#${gradId})`}
            />
          </svg>
        </span>
      );
    }

    case 'bell': {
      const gradId = `${uidPrefix}_bel`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="8" y1="4" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <path
              d="M18 4.5C13.3 4.5 9.5 8.3 9.5 13V19.2L7 23.2C6.6 23.9 7.1 24.8 7.9 24.8H28.1C28.9 24.8 29.4 23.9 29 23.2L26.5 19.2V13C26.5 8.3 22.7 4.5 18 4.5Z"
              fill={`url(#${gradId})`}
            />
            <path d="M14.8 27C15.2 28.7 16.5 29.8 18 29.8C19.5 29.8 20.8 28.7 21.2 27H14.8Z" fill="#B45309" />
          </svg>
        </span>
      );
    }

    case 'warning': {
      const gradId = `${uidPrefix}_wrn`;
      return (
        <span className={className} style={wrapStyle} aria-hidden="true">
          <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id={gradId} x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FCD34D" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            <path
              d="M16.2 5.4C17 4 19 4 19.8 5.4L32.1 27.6C32.9 29 31.9 30.8 30.3 30.8H5.7C4.1 30.8 3.1 29 3.9 27.6L16.2 5.4Z"
              fill={`url(#${gradId})`}
            />
            <rect x="16.6" y="13" width="2.8" height="9" rx="1.4" fill="#1F2937" />
            <circle cx="18" cy="25.5" r="1.6" fill="#1F2937" />
          </svg>
        </span>
      );
    }
  }
};
