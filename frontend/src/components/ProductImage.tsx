/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, colorHex } from '@/domain/product';
import type { Category } from '@/types';

interface ProductImageProps {
  src: string | null | undefined;
  name: string;
  category: Category;
  color?: string | null;
  alt?: string;
}

// Foto con carga diferida (RNF-03). Si no hay imagen o falla, muestra el color y la categoría (degradación elegante).
export default function ProductImage({
  src,
  name,
  category,
  color,
  alt,
}: ProductImageProps) {
  const [bad, setBad] = useState(false);

  useEffect(() => {
    setBad(false);
  }, [src]);

  return (
    <span className="pimg" style={{ background: colorHex(color) }}>
      {src && !bad ? (
        <img
          src={src}
          alt={alt ?? name}
          loading="lazy"
          decoding="async"
          onError={() => setBad(true)}
        />
      ) : (
        <span className="ph">{CATEGORIES[category]}</span>
      )}
    </span>
  );
}
