export { RoutingEngine, type RoutingMetrics } from './routing-engine';
export { RouterService, type RouterResponse, type RouterMetrics } from './router-service';
export { 
  getRoutingRules, 
  getContextAwareRules, 
  getPriorityWeights,
  DEFAULT_ROUTING_RULES,
  CONTEXT_AWARE_RULES,
  PRIORITY_WEIGHTS
} from './routing-rules';
export type { RoutingDecision } from '@/lib/types';
