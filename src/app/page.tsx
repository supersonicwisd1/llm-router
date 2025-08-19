'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PriorityPreset } from '@/lib/types';
import type { RouterResponse } from '@/lib/routing';
import ClientOnly from '@/components/client-only';

export default function RouterTestPage() {
  const [prompt, setPrompt] = useState('');
  const [priorityPreset, setPriorityPreset] = useState<PriorityPreset>(PriorityPreset.BALANCED);
  const [response, setResponse] = useState<RouterResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<Record<string, boolean>>({});
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [lastStatusUpdate, setLastStatusUpdate] = useState<Date | null>(null);
  
  // Fetch model availability status on component mount
  useEffect(() => {
    fetchModelStatus();
  }, []);

  // Function to fetch model status
  const fetchModelStatus = async () => {
    setIsStatusLoading(true);
    try {
      const response = await fetch('/api/route');
      if (response.ok) {
        const data = await response.json();
        const statusMap: Record<string, boolean> = {};
        data.models.forEach((model: { name: string; isAvailable: boolean }) => {
          statusMap[model.name] = model.isAvailable;
        });
        setModelStatus(statusMap);
        setLastStatusUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch model status:', error);
    } finally {
      setIsStatusLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsProcessing(true);
    setError(null);
    setResponse(null);

    try {
      // Call the API route instead of creating RouterService on client
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          priorityPreset,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Routing failed');
      }

      const result = await response.json();
      setResponse(result);
      
      // Refresh model status after processing to show real-time availability
      await fetchModelStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPriorityColor = (priority: PriorityPreset) => {
    const colors = {
      [PriorityPreset.BALANCED]: 'bg-blue-500',
      [PriorityPreset.QUALITY]: 'bg-green-500',
      [PriorityPreset.COST]: 'bg-yellow-500',
      [PriorityPreset.LATENCY]: 'bg-purple-500',
    };
    return colors[priority] || 'bg-gray-500';
  };

  // Helper function to format markdown-like text
  const formatMarkdown = (text: string): string => {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-white mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-gray-300 italic">$1</em>')
      // Lists - improved to handle various list formats
      .replace(/^(\s*)[*\-]\s+(.*$)/gim, '<li class="ml-4 mb-1">$2</li>')
      .replace(/^(\s*)\d+\.\s+(.*$)/gim, '<li class="ml-4 mb-1">$1. $2</li>')
      // Code
      .replace(/`(.*?)`/g, '<code class="bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Better paragraph handling
      .replace(/\n\n+/g, '</p><p class="mb-3">')
      .replace(/^/, '<p class="mb-3">')
      .replace(/$/, '</p>')
      // Clean up empty paragraphs
      .replace(/<p class="mb-3"><\/p>/g, '')
      .replace(/<p class="mb-3">\s*<\/p>/g, '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">LLM Router Test - Full System</h1>
          <p className="text-xl text-zinc-400">Testing complete routing system with classification and model selection</p>
        </div>

        {/* Reset Models Button */}
        <div className="text-center">
          <Button
            onClick={() => {
              fetch('/api/route', { method: 'PUT', body: JSON.stringify({ action: 'reset' }) })
                .then(() => fetchModelStatus());
            }}
            variant="outline"
            size="lg"
            className="bg-blue-600 border-blue-700 text-white hover:bg-blue-700 px-3"
          >
            🔄 Reset All Models
          </Button>
        </div>

        {/* Input Form */}
        <Card className="bg-white/[0.05] border-white/[0.1]">
          <CardHeader>
            <CardTitle className="text-white">Test Prompt</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter a prompt to test the complete routing system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientOnly fallback={<div className="p-4 text-zinc-400">Loading form...</div>}>
              <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Prompt</label>
                  <Input
                    className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500"
                    placeholder="Enter your prompt here..."
                    autoComplete="off"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Priority Preset</label>
                  <Select
                     value={priorityPreset}
                     onValueChange={(value: string) => setPriorityPreset(value as PriorityPreset)}
                     disabled={isProcessing}
                   >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value={PriorityPreset.BALANCED}>Balanced</SelectItem>
                      <SelectItem value={PriorityPreset.QUALITY}>Quality First</SelectItem>
                      <SelectItem value={PriorityPreset.COST}>Cost First</SelectItem>
                      <SelectItem value={PriorityPreset.LATENCY}>Latency First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  disabled={!prompt.trim() || isProcessing} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isProcessing ? 'Processing...' : 'Test Full Routing'}
                </Button>
              </form>
            </ClientOnly>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="bg-red-500/[0.1] border-red-500/[0.3]">
            <CardContent className="pt-6">
              <div className="text-red-400 text-center">
                <strong>Error:</strong> {error}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-6">
            {/* Model Response */}
            <Card className="bg-white/[0.05] border-white/[0.1]">
              <CardHeader>
                <CardTitle className="text-white">Model Response</CardTitle>
                <CardDescription className="text-zinc-400">
                  Generated by {response.modelUsed}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  <div 
                    className="bg-zinc-800 rounded-lg p-4 text-white"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(response.response) }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Routing Details */}
            <Card className="bg-white/[0.05] border-white/[0.1]">
              <CardHeader>
                <CardTitle className="text-white">Routing Details</CardTitle>
                <CardDescription className="text-zinc-400">
                  How the system chose the model and processed your request
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{response.promptType}</div>
                    <div className="text-sm text-zinc-400">Prompt Type</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {((response.classificationConfidence || 0) * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-zinc-400">Classification Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      ${(response.actualCost || 0).toFixed(4)}
                    </div>
                    <div className="text-sm text-zinc-400">Actual Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {response.actualLatency}ms
                    </div>
                    <div className="text-sm text-zinc-400">Latency</div>
                  </div>
                </div>

                {/* Priority Weights */}
                <div className="border-t border-zinc-700 pt-4">
                  <h4 className="text-zinc-300 font-medium mb-3">Priority Weights Applied</h4>
                  <div className="flex gap-2">
                    <Badge className={`${getPriorityColor(priorityPreset)} text-white`}>
                      {priorityPreset}
                    </Badge>
                    <Badge className="bg-zinc-600 text-white">
                      Quality: {((response.routingDecision?.priorityWeights?.quality || 0) * 100).toFixed(0)}%
                    </Badge>
                    <Badge className="bg-zinc-600 text-white">
                      Cost: {((response.routingDecision?.priorityWeights?.cost || 0) * 100).toFixed(0)}%
                    </Badge>
                    <Badge className="bg-zinc-600 text-white">
                      Latency: {((response.routingDecision?.priorityWeights?.latency || 0) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>

                {/* Routing Decision */}
                <div className="border-t border-zinc-700 pt-4">
                  <h4 className="text-zinc-300 font-medium mb-3">Routing Decision</h4>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="text-white text-sm">
                        <strong>Selected Model:</strong> {response.routingDecision?.selectedModel || 'Unknown'}
                      </div>
                      <Badge className="bg-green-600 text-white">
                        Score: {((response.routingDecision?.score || 0) * 100).toFixed(1)}
                      </Badge>
                    </div>
                    <div className="text-zinc-300 text-sm mt-1">
                      <strong>Reasoning:</strong> {response.routingDecision?.reasoning || 'No reasoning provided'}
                    </div>
                    <div className="text-zinc-300 text-sm mt-1">
                      <strong>Confidence:</strong> {((response.routingDecision?.confidence || 0) * 100).toFixed(1)}%
                    </div>
                    {response.routingDecision?.fallbackModel && (
                      <div className="text-zinc-300 text-sm mt-1">
                        <strong>Fallback:</strong> {response.routingDecision.fallbackModel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alternatives */}
                {response.routingDecision?.alternatives && response.routingDecision.alternatives.length > 0 && (
                  <div className="border-t border-zinc-700 pt-4">
                    <h4 className="text-zinc-300 font-medium mb-3">Alternative Models</h4>
                    <div className="space-y-2">
                      {response.routingDecision.alternatives.map((alt, index: number) => (
                        <div key={index} className="bg-zinc-800 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{alt.modelName || 'Unknown'}</span>
                            <Badge className="bg-zinc-600 text-white">
                              Score: {((alt.score || 0) * 100).toFixed(1)}
                            </Badge>
                          </div>
                          <div className="text-zinc-300 text-sm mt-1">{alt.reason || 'No reason provided'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost Savings */}
                <div className="border-t border-zinc-700 pt-4">
                  <h4 className="text-zinc-300 font-medium mb-3">Cost Analysis</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-400">
                        ${(response.costSavings || 0).toFixed(4)}
                      </div>
                      <div className="text-sm text-zinc-400">Cost Savings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-400">
                        ${(response.routingDecision?.estimatedCost || 0).toFixed(4)}
                      </div>
                      <div className="text-sm text-zinc-400">Estimated Cost</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* System Info */}
        <Card className="bg-white/[0.05] border-white/[0.1]">
          <CardHeader>
            <CardTitle className="text-white">System Information</CardTitle>
            <CardDescription className="text-zinc-400">
              Current routing configuration and available models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-zinc-300 font-medium mb-3">Priority Presets</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Balanced:</span>
                    <span className="text-white">Quality 45% | Cost 30% | Latency 25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Quality First:</span>
                    <span className="text-white">Quality 65% | Cost 15% | Latency 20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Cost First:</span>
                    <span className="text-white">Quality 30% | Cost 50% | Latency 20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Latency First:</span>
                    <span className="text-white">Quality 30% | Cost 20% | Latency 50%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-zinc-300 font-medium mb-3 flex items-center justify-between">
                  Available Models
                  {lastStatusUpdate && (
                    <span className="text-xs text-zinc-500 font-normal">
                      Last updated: {lastStatusUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Claude 3.7 Sonnet:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">High Quality, 200K Context</span>
                      <Badge className={`${modelStatus['claude-3-7-sonnet-20250219'] ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {modelStatus['claude-3-7-sonnet-20250219'] ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">GPT-5:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">Best for Q&A & Math, 400K Context</span>
                      <Badge className={`${modelStatus['gpt-5'] ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {modelStatus['gpt-5'] ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Gemini 1.5 Flash:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">Cost-effective, 1M Context</span>
                      <Badge className={`${modelStatus['gemini-1.5-flash'] ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {modelStatus['gemini-1.5-flash'] ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">GPT-4o-mini:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">Cost-effective, 128K Context</span>
                      <Badge className={`${modelStatus['gpt-4o-mini'] ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {modelStatus['gpt-4o-mini'] ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">GPT-OSS-20B:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">Free via Hugging Face, 128K Context</span>
                      <Badge className={`${modelStatus['gpt-oss-20b'] ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {modelStatus['gpt-oss-20b'] ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
