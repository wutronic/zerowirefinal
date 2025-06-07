"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Upload,
  Mic,
  SplitSquareVertical,
  Settings,
  Save,
  Volume2,
  FileAudio,
  List,
  Trash2,
  RefreshCw,
  Wand2,
  Bug,
  Layers,
  Sparkles
} from "lucide-react";

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

// Audio History Item Interface
interface AudioHistoryItem {
  id: string;
  text: string;
  audioUrl: string;
  timestamp: Date;
}

// Main Video Settings Component
const VideoSettingsApp: React.FC = () => {
  // UI State
  const [splitScreenEnabled, setSplitScreenEnabled] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedClip, setSelectedClip] = useState<File | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

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

  // Load audio history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('audioHistory');
    if (savedHistory) {
      try {
        setAudioHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse audio history from localStorage');
      }
    }
  }, []);

  // Save audio history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('audioHistory', JSON.stringify(audioHistory));
  }, [audioHistory]);

  const handleClipSelect = (file: File) => {
    setSelectedClip(file);
  };

  const handleGenerateAudio = () => {
    if (!initialAudioText.trim()) {
      return;
    }

    setIsProcessing(true);
    
    // Simulate audio generation with a timeout
    setTimeout(() => {
      const newAudioItem: AudioHistoryItem = {
        id: Date.now().toString(),
        text: initialAudioText,
        audioUrl: "https://ui.webmakers.studio/audio/ncs.mp3", // Placeholder URL
        timestamp: new Date()
      };
      
      setAudioHistory(prev => [newAudioItem, ...prev]);
      setCurrentAudioUrl(newAudioItem.audioUrl);
      setIsProcessing(false);
    }, 1500);
  };

  const handleSubmit = () => {
    setIsProcessing(true);
    
    // Simulate processing with a timeout
    setTimeout(() => {
      setIsProcessing(false);
      // Here you would handle the actual submission logic
    }, 2000);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setAudioHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleSelectHistoryItem = (item: AudioHistoryItem) => {
    setInitialAudioText(item.text);
    setCurrentAudioUrl(item.audioUrl);
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
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleGenerateAudio}
                      disabled={!initialAudioText.trim() || isProcessing}
                      className="gap-2"
                    >
                      {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                      Generate Audio Only
                    </Button>
                  </div>
                  
                  {currentAudioUrl && (
                    <div className="pt-4">
                      <Label>Preview Generated Audio</Label>
                      <AudioPlayer 
                        src={currentAudioUrl}
                        title="Generated Audio"
                      />
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
          
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline">Reset All</Button>
            <Button 
              onClick={handleSubmit}
              disabled={isProcessing || !initialAudioText.trim()}
              className="gap-2"
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {splitScreenEnabled ? "Generate Split-Screen Video" : "Generate Video"}
            </Button>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Audio History</span>
                <Button variant="ghost" size="icon">
                  <List className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Previously generated audio clips</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {audioHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <FileAudio className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No audio history yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generated audio will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {audioHistory.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectHistoryItem(item)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate max-w-[80%]">
                            {item.text.substring(0, 50)}{item.text.length > 50 ? '...' : ''}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistoryItem(item.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VideoSettingsApp; 