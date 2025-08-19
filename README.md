# 🚀 LLM Router - Intelligent Model Selection & Cost Optimization

An intelligent routing system that automatically selects the most cost-effective LLM for your prompts while maintaining quality and performance.

## ✨ **Features**

- **🤖 Smart Classification**: Automatically detects prompt types (Q&A, code generation, summarization, creative writing, math reasoning)
- **💰 Cost Optimization**: Routes requests to the most cost-effective model based on your priorities
- **⚡ Performance Tuning**: Configurable routing rules for cost, latency, quality, or balanced approaches
- **🔄 Fail-Safe Routing**: Automatic fallback to reliable models if primary models fail
- **📊 Real-Time Analytics**: Monitor costs, latency, and model performance in real-time
- **🎯 Priority Presets**: Choose between cost-first, quality-first, latency-first, or balanced routing
- **🌐 Web Interface**: Beautiful, responsive UI for testing and monitoring your routing system

## 🏗️ **Architecture**

```
User Prompt → Classification Engine → Routing Rules → Model Selection → Response Generation → Analytics
     ↓              ↓                ↓              ↓               ↓              ↓
  Text Input   GPT-4o-mini      Configurable    Smart Scoring   LLM Provider   Cost/Latency
              (Fast & Cheap)     Priorities     Algorithm       Selection      Tracking
```

## 🎯 **Supported Models**

| Provider | Model | Context | Cost (Input/Output) | Best For |
|----------|-------|---------|---------------------|----------|
| **OpenAI** | GPT-5 | 128K | $5/$15 per 1M tokens | Complex reasoning, math |
| **OpenAI** | GPT-4o | 128K | $5/$15 per 1M tokens | High-quality responses |
| **OpenAI** | GPT-4o-mini | 128K | $0.15/$0.60 per 1M tokens | Classification, simple tasks |
| **Anthropic** | Claude 3.7 Sonnet | 200K | $3/$15 per 1M tokens | Creative writing, code |
| **Google** | Gemini 1.5 Flash | 1M | $0.075/$0.30 per 1M tokens | Long context, cost-effective |
| **Hugging Face** | GPT-OSS-20B | 128K | **FREE** | Cost-sensitive tasks |

## 🚀 **Quick Start**

### **1. Clone & Install**
```bash
git clone <your-repo-url>
cd llm-router
npm install
```

### **2. Environment Setup**
Create `.env.local` in the root directory:
```bash
# Required API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional API Keys (for additional models)
GOOGLE_AI_API_KEY=your_google_key_here
HF_TOKEN=your_huggingface_token_here (optional)

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### **3. Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000/router-test](http://localhost:3000/router-test) to test the router!

## 🎮 **Usage**

### **Web Interface**
1. Navigate to `/router-test`
2. Enter your prompt
3. Select priority preset (cost, quality, latency, balanced)
4. View real-time routing decisions and model selection
5. Monitor costs, latency, and response quality

### **Priority Presets**

- **💰 Cost-First**: Minimizes cost while maintaining acceptable quality
- **🎯 Quality-First**: Prioritizes response quality over cost
- **⚡ Latency-First**: Optimizes for speed and responsiveness
- **⚖️ Balanced**: Balanced approach considering all factors

### **Example Prompts**

- **Code Generation**: "Write a Python function to sort a list"
- **Creative Writing**: "Tell me a story about a robot learning to paint"
- **Q&A**: "Explain quantum physics in simple terms"
- **Summarization**: "Summarize the key points of machine learning"
- **Math**: "Solve: 2x + 5 = 13"

## 🔧 **Configuration**

### **Routing Rules**
Customize routing behavior in `src/lib/routing/routing-rules.ts`:
```typescript
export const DEFAULT_ROUTING_RULES = {
  [PromptType.CODE]: ['claude-3-7-sonnet', 'gpt-5', 'gemini-1.5-flash'],
  [PromptType.CREATIVE]: ['claude-3-7-sonnet', 'gpt-5', 'gemini-1.5-flash'],
  // ... customize for your needs
}
```

### **Model Registry**
Add or modify models in `src/lib/models/model-registry.ts`:
```typescript
'my-custom-model': {
  provider: Provider.OPENAI,
  modelName: 'gpt-4',
  contextWindowTokens: 8192,
  priceInputPerMillion: 30,
  priceOutputPerMillion: 60,
  // ... other properties
}
```

## 🏗️ **Project Structure**

```
src/
├── app/                    # Next.js App Router
│   ├── router-test/       # Main testing interface
│   └── api/route/         # API endpoints
├── lib/
│   ├── models/            # LLM client implementations
│   ├── routing/           # Routing engine & rules
│   └── types/             # TypeScript definitions
├── components/            # Reusable UI components
└── utils/                 # Utilities & logging
```

## 🔍 **How It Works**

### **1. Prompt Classification**
- **Heuristic Classification**: Fast keyword-based detection
- **Model-Based Classification**: GPT-4o-mini for accurate classification
- **Hybrid Approach**: Combines both for optimal performance

### **2. Model Selection**
- **Scoring Algorithm**: Multi-factor scoring (cost, quality, latency, context)
- **Priority Weights**: Configurable importance for different factors
- **Availability Check**: Real-time model health monitoring

### **3. Response Generation**
- **Client Abstraction**: Unified interface for all providers
- **Error Handling**: Automatic fallback to reliable models
- **Performance Tracking**: Latency, cost, and quality metrics

## 📊 **Monitoring & Analytics**

### **Real-Time Metrics**
- **Cost per request** and total cost savings
- **Response latency** and throughput
- **Model selection** and routing decisions
- **Error rates** and fallback usage

### **Model Performance**
- **Availability status** for all models
- **Success/failure rates** by model
- **Cost efficiency** comparisons
- **Quality metrics** tracking

## 🛠️ **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### **Adding New Models**
1. **Update Model Registry**: Add model configuration
2. **Implement Client**: Create provider-specific client
3. **Update Factory**: Add to client factory
4. **Test Integration**: Verify routing works correctly

### **Custom Routing Logic**
Extend `RoutingEngine` class in `src/lib/routing/routing-engine.ts`:
```typescript
class CustomRoutingEngine extends RoutingEngine {
  protected scoreModels(models: ModelConfig[], promptType: PromptType): ModelScore[] {
    // Implement your custom scoring logic
  }
}
```

## 🚧 **Troubleshooting**

### **Common Issues**

**"Model not available" errors:**
- Check API keys are correctly set
- Verify model names in registry
- Check provider API status

**High latency:**
- Review priority preset selection
- Check model availability
- Consider cost vs. performance trade-offs

**Classification failures:**
- Ensure GPT-4o-mini is accessible
- Check classification confidence threshold
- Review prompt type mapping

### **Debug Mode**
Enable detailed logging by setting environment variable:
```bash
DEBUG=true npm run dev
```

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your changes
4. **Test** thoroughly
5. **Submit** a pull request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **OpenAI** for GPT models and API
- **Anthropic** for Claude models
- **Google** for Gemini models
- **Hugging Face** for free model access
- **Next.js** team for the amazing framework

## 📞 **Support**

- **Issues**: [GitHub Issues](your-repo-url/issues)
- **Discussions**: [GitHub Discussions](your-repo-url/discussions)
- **Documentation**: [Project Wiki](your-repo-url/wiki)

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
