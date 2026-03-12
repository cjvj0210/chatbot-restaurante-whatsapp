import { useState, useRef, useEffect } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

/**
 * Componente de imagem com lazy loading nativo + fallback visual
 * - Usa loading="lazy" do browser para carregar apenas quando visível
 * - Mostra placeholder animado enquanto carrega
 * - Trata erro de carregamento com fallback
 */
export function LazyImage({ src, alt, className = "", placeholderClassName = "" }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Se a imagem já está no cache do browser
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  if (error) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${placeholderClassName || className}`}>
        <span className="text-muted-foreground text-xs">Sem foto</span>
      </div>
    );
  }

  return (
    <div className={`relative ${placeholderClassName || className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted/50 animate-pulse rounded" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
