import type { RiskCategoryId } from '../models/environment';
import { categoryLabel } from '../core/categories';
import { riskColor } from '../theme/theme';
import { formatScore } from '../utils/format';
import { InsightCard } from './InsightCard';
import { EnvironmentalIcon } from './icons/EnvironmentalIcon';
import type { EnvironmentalIconName } from './icons/environmentalIconTypes';

interface ScoreCardProps {
  title: string;
  score: number | null;
  category: RiskCategoryId;
  subtitle?: string;
  details?: string[];
  iconName?: EnvironmentalIconName | undefined;
  onPress?: (() => void) | undefined;
}

export function ScoreCard({
  title,
  score,
  category,
  subtitle,
  details = [],
  iconName,
  onPress,
}: ScoreCardProps) {
  const accent = riskColor(category);

  return (
    <InsightCard
      title={title}
      accent={accent}
      icon={iconName ? <EnvironmentalIcon name={iconName} size="card" /> : undefined}
      primary={formatScore(score)}
      secondary={categoryLabel(category)}
      details={[...(subtitle ? [subtitle] : []), ...details]}
      onPress={onPress}
      accessibilityLabel={`${title}: ${formatScore(score)}, ${categoryLabel(category)}. Opens details.`}
    />
  );
}
