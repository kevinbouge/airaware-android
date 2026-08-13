import type { RiskCategoryId } from '../models/environment';
import { categoryLabel } from '../core/categories';
import { riskColor } from '../theme/theme';
import { formatScore } from '../utils/format';
import { InsightCard } from './InsightCard';

interface ScoreCardProps {
  title: string;
  score: number | null;
  category: RiskCategoryId;
  subtitle?: string;
  details?: string[];
  onPress?: (() => void) | undefined;
}

export function ScoreCard({
  title,
  score,
  category,
  subtitle,
  details = [],
  onPress,
}: ScoreCardProps) {
  const accent = riskColor(category);

  return (
    <InsightCard
      title={title}
      accent={accent}
      primary={formatScore(score)}
      secondary={categoryLabel(category)}
      details={[...(subtitle ? [subtitle] : []), ...details]}
      onPress={onPress}
      accessibilityLabel={`${title}: ${formatScore(score)}, ${categoryLabel(category)}. Opens details.`}
    />
  );
}
