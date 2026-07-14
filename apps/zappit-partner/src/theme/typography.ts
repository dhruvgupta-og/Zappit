import { TextStyle } from 'react-native';

const fontFamily = 'System';

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, fontFamily },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, fontFamily },
  h3: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, fontFamily },
  h4: { fontSize: 16, fontWeight: '700', fontFamily },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, fontFamily },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, fontFamily },
  caption: { fontSize: 12, fontWeight: '500', fontFamily },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily },
  button: { fontSize: 16, fontWeight: '700', fontFamily },
  buttonSmall: { fontSize: 14, fontWeight: '600', fontFamily },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, full: 9999 };
