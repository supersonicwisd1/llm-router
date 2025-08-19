import { z } from 'zod';

// Server-side environment validation
const envSchema = z.object({
  NODE_ENV: z.string(),
  NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
  // OpenAI API Configuration
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_ORGANIZATION: z.string().optional(),
  // Anthropic API Configuration
  ANTHROPIC_API_KEY: z.string().min(1, "Anthropic API key is required"),
  // Google AI Configuration (Optional)
  GOOGLE_AI_API_KEY: z.string().optional(),
  // Hugging Face Configuration (Optional for free models)
  HF_TOKEN: z.string().optional(),
  // Database Configuration
  DATABASE_PATH: z.string().default("./llm_router.db"),
  // Classification Configuration
  CLASSIFICATION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  EMBEDDING_CACHE_TTL: z.coerce.number().min(0).default(3600),
  // Model Configuration
  DEFAULT_PRIORITY_PRESET: z.enum(["balanced", "quality", "cost", "latency"]).default("balanced"),
  MAX_RETRY_ATTEMPTS: z.coerce.number().min(1).max(5).default(2),
  REQUEST_TIMEOUT_MS: z.coerce.number().min(5000).max(120000).default(30000),
});

// Client-safe environment variables (only public ones)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

// Server-side environment validation
export const env = (() => {
  if (typeof window === 'undefined') {
    // Server-side validation
    try {
      return envSchema.parse(process.env);
    } catch (error) {
      console.error('❌ Invalid environment variables:', error);
      throw error;
    }
  } else {
    // Client-side: only validate public variables
    try {
      return clientEnvSchema.parse({
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      });
    } catch (error) {
      console.error('❌ Invalid client environment variables:', error);
      // Return a default client environment instead of throwing
      return {
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      };
    }
  }
})();

// Export individual environment variables for server-side use
export const getServerEnv = () => {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() can only be called on the server side');
  }
  return envSchema.parse(process.env);
};
