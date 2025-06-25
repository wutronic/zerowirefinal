"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  Upload,
  Mic,
  SplitSquareVertical,
  FileAudio,
  List,
  Trash2,
  RefreshCw,
  Sparkles,
  Download,
  ExternalLink
} from "lucide-react";
import ClaudeGenerator from './ClaudeGenerator';

// Custom Slider for Audio Player
const CustomSlider = ({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) => {
  return (
    <motion.div
      className={cn(
        "relative w-full h-1 bg-background/20 rounded-full cursor-pointer",
        className
      )}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        onChange(Math.min(Math.max(percentage, 0), 100));
      }}
    >
      <motion.div
        className="absolute top-0 left-0 h-full bg-primary rounded-full"
        style={{ width: `${value}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  );
};

// Format time for audio player
const formatTime = (seconds: number = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Video Spinner Component
const VideoSpinner = ({
  title,
  message,
}: {
  title?: string;
  message?: string;
}) => {
  return (
    <div className="relative flex flex-col rounded-lg overflow-hidden bg-card shadow-md p-3 w-full">
      <div className="flex flex-col relative">
        <div className="flex flex-col w-full gap-y-2">
          {title && (
            <h3 className="text-foreground font-medium text-sm">{title}</h3>
          )}

          <div className="relative flex items-center justify-center min-h-[200px] bg-muted/20 rounded-md">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {message || "Generating video..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a few minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Video Player Component
const VideoPlayer = ({
  src,
  title,
}: {
  src: string;
  title?: string;
}) => {
  if (!src) return null;

  return (
    <div className="relative flex flex-col rounded-lg overflow-hidden bg-card shadow-md p-3 w-full">
      <div className="flex flex-col relative">
        <div className="flex flex-col w-full gap-y-2">
          {title && (
            <h3 className="text-foreground font-medium text-sm">{title}</h3>
          )}

          <div className="relative">
            <video
              src={src}
              controls
              className="w-full h-auto rounded-md"
              style={{ 
                maxHeight: '400px', 
                maxWidth: '100%',
                objectFit: 'contain'
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = src;
                link.download = title || 'video.mp4';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(src, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Audio Player Component
const AudioPlayer = ({
  src,
  title,
}: {
  src: string;
  title?: string;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress =
        (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isFinite(progress) ? progress : 0);
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number) => {
    if (audioRef.current && audioRef.current.duration) {
      const time = (value / 100) * audioRef.current.duration;
      if (isFinite(time)) {
        audioRef.current.currentTime = time;
        setProgress(value);
      }
    }
  };

  if (!src) return null;

  return (
    <div className="relative flex flex-col rounded-lg overflow-hidden bg-card shadow-md p-3 w-full">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        src={src}
        className="hidden"
      />

      <div className="flex flex-col relative">
        <div className="flex flex-col w-full gap-y-2">
          {title && (
            <h3 className="text-foreground font-medium text-sm">{title}</h3>
          )}

          <div className="flex flex-col gap-y-1">
            <CustomSlider
              value={progress}
              onChange={handleSeek}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                {formatTime(currentTime)}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center w-full">
            <div className="flex items-center gap-2 w-fit rounded-lg p-1">
              <Button
                onClick={togglePlay}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// File Drop Area Component
interface FileDropAreaProps {
  onFileDrop: (file: File) => void;
  accept?: string;
  className?: string;
  children?: React.ReactNode;
}

const FileDropArea: React.FC<FileDropAreaProps> = ({
  onFileDrop,
  accept = "video/*,image/*",
  className,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileDrop(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileDrop(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={accept}
        className="hidden"
      />
      {children || (
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            Drag and drop a file or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supported formats: MP4, MOV, JPG, PNG
          </p>
        </div>
      )}
    </div>
  );
};

// Main Video Settings Component
const VideoSettingsApp: React.FC = () => {
  // UI State
  const [splitScreenEnabled, setSplitScreenEnabled] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedClip, setSelectedClip] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  // Audio Settings - matching your chunk_clone.py defaults and typical usage
  const [initialAudioText, setInitialAudioText] = useState("this is a test.");
  const [targetLevel, setTargetLevel] = useState("0.8"); // Your typical usage
  const [compressionRatio, setCompressionRatio] = useState("6.0"); // Your typical usage
  const [audioEnhancement, setAudioEnhancement] = useState(true); // Default enabled
  const [audioNormalization, setAudioNormalization] = useState(true); // Default enabled
  const [audioCompression, setAudioCompression] = useState(true); // Default enabled
  
  // Advanced Settings
  const [outputPrefix, setOutputPrefix] = useState("chunk"); // Default from chunk_clone.py
  const [voiceFile, setVoiceFile] = useState(""); // Training voice by default
  const [processingQuality, setProcessingQuality] = useState("Standard");
  const [outputFormat, setOutputFormat] = useState("MP4");

  const handleClipSelect = (file: File) => {
    setSelectedClip(file);
  };

  const handleGenerateAudio = async () => {
    if (!initialAudioText.trim()) {
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Generating audio...');
    
    try {
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: initialAudioText,
          targetLevel,
          compressionRatio,
          audioEnhancement,
          audioNormalization,
          audioCompression,
          outputPrefix,
          voiceFile
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Audio generation failed');
      }

      setCurrentAudioUrl(`/audio/${result.audioFilePath}`);
      
      console.log('Audio generation successful:', result);
      setStatusMessage('Audio generated successfully!');
      
    } catch (error) {
      console.error('Audio generation failed:', error);
      setStatusMessage(`Audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(''), 5000); // Clear status after 5 seconds for errors
    }
  };

  const handleSubmit = async () => {
    if (!initialAudioText.trim()) {
      return;
    }

    setIsGeneratingVideo(true);
    setCurrentVideoUrl(null); // Clear previous video to show spinner
    setProgressMessages([]);
    setStatusMessage('Starting video generation...');
    
    // Helper function to add progress messages
    const addProgressMessage = (message: string) => {
      setProgressMessages(prev => {
        const newMessages = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
        // Keep only last 10 messages to avoid overflow
        return newMessages.slice(-10);
      });
    };
    
    try {
      const textLength = initialAudioText.length;
      const expectedChunks = Math.ceil(textLength / 200);
      
      setStatusMessage(`Generating video (${textLength} chars, ~${expectedChunks} chunks)... This may take a few minutes.`);
      addProgressMessage(`📝 Text length: ${textLength} characters`);
      if (textLength > 200) {
        addProgressMessage(`🔄 Expected to split into ~${expectedChunks} chunks`);
      }
      
      const formData = new FormData();
      formData.append('text', initialAudioText);
      formData.append('splitScreenEnabled', splitScreenEnabled.toString());
      formData.append('targetLevel', targetLevel);
      formData.append('compressionRatio', compressionRatio);
      formData.append('audioEnhancement', audioEnhancement.toString());
      formData.append('audioNormalization', audioNormalization.toString());
      formData.append('audioCompression', audioCompression.toString());
      formData.append('outputPrefix', outputPrefix);
      formData.append('voiceFile', voiceFile);
      formData.append('debugMode', debugMode.toString());
      
      if (splitScreenEnabled && selectedClip) {
        formData.append('splitScreenClip', selectedClip);
        addProgressMessage(`🎬 Split screen enabled with uploaded clip`);
      }

      addProgressMessage(`🚀 Starting generation process...`);
      
      // Start progress polling for TTS chunking progress
      const pollProgress = async () => {
        try {
          const progressResponse = await fetch('/api/progress');
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            if (progressData.message) {
              addProgressMessage(progressData.message);
            }
          }
        } catch (error) {
          // Ignore progress polling errors
        }
      };
      
      // Poll every 2 seconds for progress updates  
      const progressInterval = setInterval(pollProgress, 2000);
      
      let response;
      const startTime = Date.now();
      try {
        response = await fetch('/api/generate-video', {
          method: 'POST',
          body: formData,
        });

        const apiCallTime = ((Date.now() - startTime) / 1000).toFixed(1);
        addProgressMessage(`⏱️ API call completed in ${apiCallTime}s`);
      } finally {
        // Always stop progress polling
        clearInterval(progressInterval);
        // Clear any remaining cached progress messages
        await fetch('/api/progress/clear', { method: 'POST' }).catch(() => {});
      }
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Video generation failed');
      }

      console.log('Video generation successful:', result);
      addProgressMessage(`✅ Video generation successful!`);
      
      const processingTime = result.processingTime || 'Unknown';
      const coordinationMethod = result.coordinationMethod || 'direct';
      
      // Set video URL for preview
      if (result.videoFilePath) {
        const videoFileName = result.videoFilePath.replace(/.*\//, '');
        setCurrentVideoUrl(`/api/videos/${videoFileName}`);
        addProgressMessage(`🎥 Video ready: ${videoFileName}`);
      }
      
      if (result.splitScreenUsed) {
        addProgressMessage(`🎬 Split screen fusion completed`);
      }
      
      addProgressMessage(`⏱️ Total processing time: ${processingTime}`);
      addProgressMessage(`🔧 Method: ${coordinationMethod}`);
      
      setStatusMessage(`Video generated successfully! Processing time: ${processingTime}, Method: ${coordinationMethod}`);
      
    } catch (error) {
      console.error('Video generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addProgressMessage(`❌ Error: ${errorMessage}`);
      setStatusMessage(`Video generation failed: ${errorMessage}`);
    } finally {
      setIsGeneratingVideo(false);
      setTimeout(() => {
        setStatusMessage('');
        setProgressMessages([]);
      }, 8000); // Clear status and progress after 8 seconds
    }
  };

  // Generate command preview
  const generateCommandPreview = () => {
    const baseCommand = `python chunk_clone.py "${initialAudioText}"`;
    const args = [];
    
    if (targetLevel !== "0.7") args.push(`--target-level ${targetLevel}`);
    if (compressionRatio !== "3.0") args.push(`--compression-ratio ${compressionRatio}`);
    if (!audioEnhancement) args.push(`--no-enhance`);
    if (!audioNormalization && audioEnhancement) args.push(`--no-normalize`);
    if (!audioCompression && audioEnhancement) args.push(`--no-compress`);
    if (outputPrefix !== "chunk") args.push(`--output-prefix ${outputPrefix}`);
    if (voiceFile) args.push(`--voice ${voiceFile}`);
    
    return args.length > 0 ? `${baseCommand} ${args.join(' ')}` : baseCommand;
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Video Generation Dashboard</h1>
        <p className="text-muted-foreground">Configure text-to-speech and video generation settings</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="audio">Audio & TTS</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Text Input</CardTitle>
                  <CardDescription>Enter text to convert to speech and generate video</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="initial-audio-text">Text for Speech Generation</Label>
                    <Textarea
                      id="initial-audio-text"
                      placeholder="Enter text to convert to speech..."
                      value={initialAudioText}
                      onChange={(e) => setInitialAudioText(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="text-xs text-muted-foreground">
                      Character count: {initialAudioText.length}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Split Screen Settings</CardTitle>
                  <CardDescription>Configure split screen mode for the start of your video</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="split-screen">Enable Split Screen Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Show two video streams side by side at the beginning
                      </p>
                    </div>
                    <Switch
                      id="split-screen"
                      checked={splitScreenEnabled}
                      onCheckedChange={setSplitScreenEnabled}
                    />
                  </div>
                  
                  {splitScreenEnabled && (
                    <div className="pt-4 space-y-4">
                      <Label>Select Clip for Split Screen</Label>
                      <FileDropArea 
                        onFileDrop={handleClipSelect}
                        accept="video/*,image/*"
                        className={selectedClip ? "border-primary" : ""}
                      >
                        {selectedClip && (
                          <div className="flex flex-col items-center gap-2">
                            <SplitSquareVertical className="h-8 w-8 text-primary" />
                            <p className="text-sm font-medium">{selectedClip.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedClip.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        )}
                      </FileDropArea>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(currentAudioUrl || currentVideoUrl) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Preview Generated Content</CardTitle>
                    <CardDescription>Preview your generated audio and video content</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentAudioUrl && (
                      <div>
                        <Label>Generated Audio</Label>
                        <AudioPlayer 
                          src={currentAudioUrl}
                          title="Generated Audio"
                        />
                      </div>
                    )}
                    {(currentVideoUrl || isGeneratingVideo) && (
                      <div>
                        <Label>Generated Video</Label>
                        {isGeneratingVideo ? (
                          <VideoSpinner 
                            title="Generating Video"
                            message={splitScreenEnabled ? "Creating split-screen video..." : "Generating video..."}
                          />
                        ) : (
                          <VideoPlayer 
                            src={currentVideoUrl!}
                            title="Generated Video"
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="audio" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audio Processing Settings</CardTitle>
                  <CardDescription>Configure Spark TTS and audio enhancement settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="audio-enhancement">Audio Enhancement</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable professional audio processing (normalization + compression)
                      </p>
                    </div>
                    <Switch
                      id="audio-enhancement"
                      checked={audioEnhancement}
                      onCheckedChange={setAudioEnhancement}
                    />
                  </div>

                  {audioEnhancement && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="audio-normalization">Audio Normalization</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically adjust audio levels to target volume
                          </p>
                        </div>
                        <Switch
                          id="audio-normalization"
                          checked={audioNormalization}
                          onCheckedChange={setAudioNormalization}
                        />
                      </div>

                      {audioNormalization && (
                        <div className="space-y-2">
                          <Label htmlFor="target-level">Target Level (0.0-1.0)</Label>
                          <Input
                            id="target-level"
                            type="number"
                            min="0.0"
                            max="1.0"
                            step="0.1"
                            value={targetLevel}
                            onChange={(e) => setTargetLevel(e.target.value)}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Default: 0.7, Your typical: 0.8. Higher = louder normalized output.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="audio-compression">Dynamic Range Compression</Label>
                          <p className="text-sm text-muted-foreground">
                            Reduce volume differences for consistent audio
                          </p>
                        </div>
                        <Switch
                          id="audio-compression"
                          checked={audioCompression}
                          onCheckedChange={setAudioCompression}
                        />
                      </div>

                      {audioCompression && (
                        <div className="space-y-2">
                          <Label htmlFor="compression-ratio">Compression Ratio</Label>
                          <Input
                            id="compression-ratio"
                            type="number"
                            min="1.0"
                            max="20.0"
                            step="0.5"
                            value={compressionRatio}
                            onChange={(e) => setCompressionRatio(e.target.value)}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Default: 3.0, Your typical: 6.0. Higher = more compression (1.0 = none).
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>Configure additional processing options and output settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="debug-mode">Debug Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Show debug overlays and additional processing information
                      </p>
                    </div>
                    <Switch
                      id="debug-mode"
                      checked={debugMode}
                      onCheckedChange={setDebugMode}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="output-prefix">Output Filename Prefix</Label>
                    <Input
                      id="output-prefix"
                      value={outputPrefix}
                      onChange={(e) => setOutputPrefix(e.target.value)}
                      placeholder="chunk"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voice-file">Custom Voice File (Optional)</Label>
                    <Input
                      id="voice-file"
                      value={voiceFile}
                      onChange={(e) => setVoiceFile(e.target.value)}
                      placeholder="Leave empty for default training voice"
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: audiooutput/Hello_world_everyone.wav or training/voice.wav
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Processing Quality</Label>
                      <div className="flex gap-2">
                        <Button 
                          variant={processingQuality === "Standard" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setProcessingQuality("Standard")}
                        >
                          Standard
                        </Button>
                        <Button 
                          variant={processingQuality === "High" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setProcessingQuality("High")}
                        >
                          High
                        </Button>
                        <Button 
                          variant={processingQuality === "Ultra" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setProcessingQuality("Ultra")}
                        >
                          Ultra
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Output Format</Label>
                      <div className="flex gap-2">
                        <Button 
                          variant={outputFormat === "MP4" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setOutputFormat("MP4")}
                        >
                          MP4
                        </Button>
                        <Button 
                          variant={outputFormat === "WebM" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setOutputFormat("WebM")}
                        >
                          WebM
                        </Button>
                        <Button 
                          variant={outputFormat === "GIF" ? "secondary" : "outline"} 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setOutputFormat("GIF")}
                        >
                          GIF
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <Label>Command Preview</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-sm font-mono break-all">
                        {generateCommandPreview()}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the equivalent command that will be executed
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 space-y-3">
            {statusMessage && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg py-2 px-4">
                  {statusMessage}
                </p>
              </div>
            )}
            
            {progressMessages.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Generation Progress</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {progressMessages.map((message, index) => (
                    <div key={index} className="text-xs font-mono text-muted-foreground">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline">Reset All</Button>
              <Button 
                onClick={handleGenerateAudio}
                disabled={!initialAudioText.trim() || isProcessing}
                className="gap-2"
                variant="secondary"
              >
                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Generate Audio Only
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isGeneratingVideo || !initialAudioText.trim()}
                className="gap-2"
              >
                {isGeneratingVideo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {splitScreenEnabled ? "Generate Split-Screen Video" : "Generate Video"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <ClaudeGenerator />
      </div>
    </div>
  );
};

export default VideoSettingsApp; 