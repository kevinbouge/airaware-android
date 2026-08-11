import Svg, { Circle, Path, type SvgProps } from 'react-native-svg';
import { GasMaskIcon } from './GasMaskIcon';

export type TabIconName = 'today' | 'data' | 'activities' | 'forecast' | 'profile' | 'settings';

interface TabIconProps extends SvgProps {
  name: TabIconName;
  size?: number;
  color: string;
}

export function TabIcon({ name, size = 24, color, ...props }: TabIconProps) {
  if (name === 'today') {
    return (
      <GasMaskIcon
        {...props}
        size={Math.round(size * 1.15)}
        color={color}
        style={[props.style, { transform: [{ translateY: 3 }] }]}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {name === 'forecast' ? (
        <>
          <Path
            d="M7 3v3M17 3v3M4.5 8.5h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m7.5 15 2.4-2.4 2.2 2.2 4.4-4.4"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {name === 'data' ? (
        <>
          <Path
            d="M5 5.5h14M5 12h14M5 18.5h14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={7} cy={5.5} r={1.1} fill={color} />
          <Circle cx={7} cy={12} r={1.1} fill={color} />
          <Circle cx={7} cy={18.5} r={1.1} fill={color} />
        </>
      ) : null}
      {name === 'activities' ? (
        <>
          <Path
            d="M5 18.5V16l5-5 3 3 6-6"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={8} cy={7} r={2.5} stroke={color} strokeWidth={2} />
          <Path d="M4.5 21h15" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'profile' ? (
        <>
          <Circle cx={12} cy={8} r={3.2} stroke={color} strokeWidth={2} />
          <Path
            d="M5.5 20c.8-3.4 3.1-5.2 6.5-5.2s5.7 1.8 6.5 5.2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <Path
            d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.8l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={12}
            cy={12}
            r={3}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
    </Svg>
  );
}
