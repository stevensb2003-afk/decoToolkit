'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { TextureMetadata } from '@/ai/flows/texture-metadata-extractor';

interface UseTextureAIOptions {
  onSuccess?: (metadata: TextureMetadata) => void;
  onError?: (error: string) => void;
}

interface UseTextureAIReturn {
  extractMetadata: (imageUrl: string, widthCm: number, heightCm: number) => Promise<TextureMetadata | null>;
  isLoading: boolean;
  error: string | null;
}

export function useTextureAI({ onSuccess, onError }: UseTextureAIOptions = {}): UseTextureAIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractMetadata = useCallback(async (
    imageUrl: string,
    widthCm: number,
    heightCm: number,
  ): Promise<TextureMetadata | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get Firebase ID token — the only credential the client sends
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Usuario no autenticado');

      const idToken = await user.getIdToken();

      const res = await fetch('/api/extract-texture-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,  // token only, never the API key
        },
        body: JSON.stringify({
          imageUrl,
          materialWidthCm: widthCm,
          materialHeightCm: heightCm,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const metadata: TextureMetadata = await res.json();
      onSuccess?.(metadata);
      return metadata;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      onError?.(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  return { extractMetadata, isLoading, error };
}
