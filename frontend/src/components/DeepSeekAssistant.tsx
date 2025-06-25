"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  Copy,
  MessageSquare,
  Settings,
  CheckCircle2,
  AlertCircle,
  Brain,
  Zap,
  Sparkles
} from "lucide-react";

interface AIResponse {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  systemPrompt: string;
  error?: string;
}

type Provider = 'deepseek' | 'claude';
type DeepSeekModel = 'chat' | 'coder' | 'reasoning';

export const AIAssistant: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [prefixPrompt, setPrefixPrompt] = useState("write a one minute video, dont use markdown, here is the text. Make it one paragraph and absolutely no filler text or explaination text, just the paragraph: ");
  const [userPrompt, setUserPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>('deepseek');
  const [model, setModel] = useState<DeepSeekModel>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState<string>("");
  const [availableProviders, setAvailableProviders] = useState<any>(null);

  // Fetch configuration on component mount
  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/ai-assistant');
        const data = await res.json();
        setDefaultSystemPrompt(data.defaultSystemPrompt || "");
        setAvailableProviders(data.supportedProviders || {});
      } catch (error) {
        console.error('Failed to fetch AI assistant configuration:', error);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async () => {
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const finalUserPrompt = prefixPrompt.trim() + userPrompt.trim();
      
      const requestBody = {
        systemPrompt: systemPrompt.trim() || undefined,
        userPrompt: finalUserPrompt,
        provider,
        ...(provider === 'deepseek' && { model }) // Only include model for DeepSeek
      };

      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setResponse({
          success: false,
          content: "",
          model: "",
          provider,
          systemPrompt: "",
          error: data.error || 'Failed to get response from AI assistant'
        });
        return;
      }

      setResponse(data);
    } catch (error) {
      console.error('Request failed:', error);
      setResponse({
        success: false,
        content: "",
        model: "",
        provider,
        systemPrompt: "",
        error: 'Network error: Failed to connect to AI assistant API'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!response?.content) return;

    try {
      await navigator.clipboard.writeText(response.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getProviderIcon = (providerType: Provider) => {
    switch (providerType) {
      case 'claude':
        return <Sparkles className="h-4 w-4" />;
      case 'deepseek':
        return <Zap className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getModelIcon = (modelType: string) => {
    switch (modelType) {
      case 'coder':
        return <Settings className="h-4 w-4" />;
      case 'reasoning':
        return <Brain className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getProviderStatus = (providerType: Provider) => {
    if (!availableProviders) return null;
    const providerConfig = availableProviders[providerType];
    return providerConfig?.configured ? '🟢' : '🔴';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          AI Assistant
        </CardTitle>
        <CardDescription>
          Generate creative content with DeepSeek or Claude Sonnet 4 for your video projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>AI Provider</Label>
          <div className="flex gap-2">
            {(['deepseek', 'claude'] as const).map((providerType) => (
              <Button
                key={providerType}
                variant={provider === providerType ? "secondary" : "outline"}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  setProvider(providerType);
                  if (providerType === 'claude') {
                    setModel('chat'); // Reset to default for Claude
                  }
                }}
              >
                {getProviderIcon(providerType)}
                {providerType === 'deepseek' ? 'DeepSeek' : 'Claude Sonnet 4'}
                <span className="text-xs">{getProviderStatus(providerType)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Model Selection - Only for DeepSeek */}
        {provider === 'deepseek' && (
          <div className="space-y-2">
            <Label>DeepSeek Model</Label>
            <div className="flex gap-2">
              {(['chat', 'coder', 'reasoning'] as const).map((modelType) => (
                <Button
                  key={modelType}
                  variant={model === modelType ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setModel(modelType)}
                >
                  {getModelIcon(modelType)}
                  {modelType.charAt(0).toUpperCase() + modelType.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Prefix Prompt */}
        <div className="space-y-2">
          <Label htmlFor="prefix-prompt">Video Generation Prefix</Label>
          <Input
            id="prefix-prompt"
            value={prefixPrompt}
            onChange={(e) => setPrefixPrompt(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This text will be prepended to your message automatically
          </p>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <Textarea
            id="system-prompt"
            placeholder={defaultSystemPrompt || "System prompt (optional - uses default if empty)"}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use default system prompt for video/content generation
          </p>
        </div>

        {/* User Prompt */}
        <div className="space-y-2">
          <Label htmlFor="user-prompt">Your Message</Label>
          
          <Textarea
            id="user-prompt"
            placeholder={`Ask ${provider === 'claude' ? 'Claude' : 'DeepSeek'} to help you with creative content, analysis, or reasoning...`}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="text-xs text-muted-foreground">
            Character count: {userPrompt.length}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!userPrompt.trim() || isLoading}
          className="w-full gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              {getProviderIcon(provider)}
              Generate with {provider === 'claude' ? 'Claude Sonnet 4' : `DeepSeek ${model.charAt(0).toUpperCase() + model.slice(1)}`}
            </>
          )}
        </Button>

        {/* Response Section */}
        {response && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  {response.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      AI Response
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Error
                    </>
                  )}
                </Label>
                {response.success && response.content && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/20 p-3">
                {response.success ? (
                  <div className="whitespace-pre-wrap text-sm">
                    {response.content}
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {response.error}
                  </div>
                )}
              </ScrollArea>

              {response.success && response.usage && (
                <div className="text-xs text-muted-foreground grid grid-cols-4 gap-2 pt-2 border-t">
                  <div>Provider: {response.provider}</div>
                  <div>Model: {response.model}</div>
                  <div>Prompt: {response.usage.prompt_tokens} tokens</div>
                  <div>Response: {response.usage.completion_tokens} tokens</div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Export with both names for compatibility
export const DeepSeekAssistant = AIAssistant; 