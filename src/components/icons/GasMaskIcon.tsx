import Svg, { Circle, Path, type SvgProps } from 'react-native-svg';

interface GasMaskIconProps extends SvgProps {
  size?: number;
  color?: string;
}

export function GasMaskIcon({ size = 24, color = '#2F6F4F', ...props }: GasMaskIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" {...props}>
      <Path
        d="M4.1 3.2C5 1.9 6.3 1.2 8 1.2s3 .7 3.9 2c.7 1 .9 2.2.7 3.5l-.5 2.6-1.7 2.2H5.6L3.9 9.3l-.5-2.6c-.2-1.3 0-2.5.7-3.5Z"
        fill="#2F343B"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Circle cx={5.7} cy={5.5} r={1.5} fill="#BFD7E6" stroke={color} strokeWidth={0.9} />
      <Circle cx={10.3} cy={5.5} r={1.5} fill="#BFD7E6" stroke={color} strokeWidth={0.9} />
      <Circle cx={8} cy={9.7} r={2.1} fill="#454C55" stroke={color} strokeWidth={1} />
      <Circle cx={8} cy={9.7} r={0.35} fill={color} />
      <Circle cx={7} cy={9.2} r={0.28} fill={color} />
      <Circle cx={9} cy={9.2} r={0.28} fill={color} />
      <Circle cx={7.2} cy={10.3} r={0.28} fill={color} />
      <Circle cx={8.8} cy={10.3} r={0.28} fill={color} />
      <Path
        d="M3.8 8.1 2.1 8.8l.7 3.4 2.3-.8Z"
        fill="#454C55"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Path
        d="m12.2 8.1 1.7.7-.7 3.4-2.3-.8Z"
        fill="#454C55"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Path
        d="m2.8 9.2.5 2.1M13.2 9.2l-.5 2.1"
        stroke={color}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}
