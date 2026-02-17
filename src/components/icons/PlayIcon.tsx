import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export const PlayIcon = ({ size = 24, color = '#ffffff' }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.426,10.097c-1.231-1.445-3.415-3.622-6.832-5.779-2.81-1.774-5.311-2.716-6.915-3.194-.9-.268-1.854-.101-2.612,.464-.758,.566-1.193,1.432-1.193,2.377V20.035c0,.945,.436,1.811,1.193,2.377,.521,.388,1.135,.589,1.761,.589,.284,0,.57-.042,.852-.125,1.604-.478,4.105-1.42,6.915-3.194,3.417-2.158,5.601-4.334,6.832-5.78,.938-1.102,.938-2.703,0-3.805Z" />
  </Svg>
);
