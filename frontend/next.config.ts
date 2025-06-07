import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['child_process', 'fs', 'path', 'os'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallback for Node.js modules on client-side (shouldn't be used but prevents build errors)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        os: false,
        path: false,
      };
    }
    
    // Prevent webpack from trying to bundle or analyze external scripts
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push(
        /^\.\.\/video-editing\//,
        /^\.\.\/zero-wire\//,
        'child_process',
        ({ context, request }: { context?: string; request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          // Ignore any spawn or child_process related dynamic imports
          if (request && (
            request.includes('spawn') || 
            request.includes('child_process') ||
            request.includes('auto-video-generator') ||
            request.includes('chunk_clone')
          )) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        }
      );
    } else {
      config.externals = [config.externals, /^\.\.\/video-editing\//, /^\.\.\/zero-wire\//];
    }
    
    return config;
  },
};

export default nextConfig;
