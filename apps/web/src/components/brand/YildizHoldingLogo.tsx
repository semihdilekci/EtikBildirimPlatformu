import { Box, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const LOGO_SRC = '/brand/yildiz-holding-logo.png';

/** Kaynak PNG: 248×21 — yatay wordmark */
export const LOGO_ASPECT_RATIO = 248 / 21;

type YildizHoldingLogoProps = {
  /** Görsel yüksekliği (px); genişlik orandan hesaplanır */
  height?: number;
  to?: string;
  marginRight?: number;
};

export function YildizHoldingLogo({ height = 22, to, marginRight }: YildizHoldingLogoProps) {
  const wrapperStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    lineHeight: 0,
    ...(marginRight !== undefined ? { mr: marginRight } : {}),
  };

  const image = (
    <Box
      component="img"
      src={LOGO_SRC}
      alt="Yıldız Holding"
      sx={{
        height,
        width: height * LOGO_ASPECT_RATIO,
        maxWidth: 'none',
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );

  if (to) {
    return (
      <Link
        component={RouterLink}
        to={to}
        underline="none"
        aria-label="Yıldız Holding — ana sayfa"
        sx={wrapperStyle}
      >
        {image}
      </Link>
    );
  }

  return <Box sx={wrapperStyle}>{image}</Box>;
}
