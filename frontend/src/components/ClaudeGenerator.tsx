"use client";

import React, { useState } from 'react';
import { useCompletion } from 'ai/react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = "You're a mix of Thomas Aquinas and guy fawkes but a little less pretentious and cheesy than guy. You're also a social media expert with track record of success. Pull out deep truths about these claims then lay them out like you're unbiased and trying to make the watcher feel smarter at the end . while the goal is to Take these claims and craft a video about a minute long that lays out all the critical points. Don't gloss over people or sources. Do not use markdown. ONLY THE ANSWER. no filler text.";
const DEFAULT_PROMPT_PREFIX = "make it one minute long instagram video script. Make sure you focus on core details, names, and concepts. no filler text. ONLY the answer.";

const ClaudeGenerator: React.FC = () => {
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [promptPrefix, setPromptPrefix] = useState(DEFAULT_PROMPT_PREFIX);
    const [isCopied, setIsCopied] = useState(false);

    const {
        completion,
        input,
        handleInputChange,
        complete,
        isLoading,
        error,
    } = useCompletion({
        api: '/api/claude',
        body: {
            systemPrompt,
        },
        initialInput: "The claim is: 'The earth is flat.'",
    });

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const finalPrompt = `${promptPrefix} ${input}`;
        await complete(finalPrompt);
    };

    const handleCopy = async () => {
        if (!completion) return;
        try {
            await navigator.clipboard.writeText(completion);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    Generate Content with AI
                </CardTitle>
                <CardDescription>
                    Use the power of Claude 3.5 Sonnet to generate video scripts or other content.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="system-prompt">System Prompt</Label>
                        <Textarea
                            id="system-prompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="h-32"
                            placeholder="Enter the system prompt..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="prompt-prefix">Prompt Prefix</Label>
                        <Input
                            id="prompt-prefix"
                            value={promptPrefix}
                            onChange={(e) => setPromptPrefix(e.target.value)}
                            placeholder="Enter a prefix to add to your message..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="user-message">Your Claim or Message</Label>
                        <Input
                            id="user-message"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Enter your message or claim..."
                        />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate"
                        )}
                    </Button>
                </form>

                {error && (
                    <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
                        <p className="font-semibold">Error</p>
                        <p>{error.message}</p>
                    </div>
                )}

                {completion && (
                    <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                            <Label>Generated Response</Label>
                            <Button variant="ghost" size="icon" onClick={handleCopy} title={isCopied ? "Copied!" : "Copy"}>
                                {isCopied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <Card>
                            <CardContent className="p-4">
                                <pre className="whitespace-pre-wrap font-sans text-sm">{completion}</pre>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ClaudeGenerator; 