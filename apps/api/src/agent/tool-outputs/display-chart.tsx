import type { displayChart } from '@loopwise/shared/tools';

import { Block } from '../markdown/index.js';

export function DisplayChartOutput({ output }: { output: displayChart.Output }) {
	if (output.error) {
		return <Block>Could not display the visualization: {output.error}</Block>;
	}
	return <Block>Visualization displayed successfully.</Block>;
}
