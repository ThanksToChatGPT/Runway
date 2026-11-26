'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCOP } from '@/domain/money';
import {
  isOverBudget,
  pieces,
  shoppingList,
  toPiecesPayload,
  total,
} from '@/domain/outfit';
import { CATEGORIES, SLOT_ORDER } from '@/domain/product';
import { useApp } from '@/context/AppContext';
import { api } from '@/services/api';
import type { Category } from '@/types';
import Price from './Price';
import ProductImage from './ProductImage';

interface OutfitPanelProps {
  onSlot: (slot: Category) => void;
}

export default function OutfitPanel({ onSlot }: OutfitPanelProps) {
  const {
    user,
    outfit,
    remove,
    lock,
    renameDraft,
    clearDraft,
    budget,
    setBudget,
    serverBudget,
    toast,
    handleError,
  } = useApp();
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState('');

  const tot = total(outfit);
  const hasServerBudget = serverBudget?.maxBudget !== undefined && serverBudget?.maxBudget !== null;
  const activeMaxBudget = hasServerBudget ? serverBudget.maxBudget : budget;
  const over = hasServerBudget
    ? serverBudget.isOverBudget
    : isOverBudget(outfit, activeMaxBudget);
  const diffCop =
    hasServerBudget && serverBudget.differenceCop !== null
      ? serverBudget.differenceCop
      : activeMaxBudget
        ? Math.abs(tot - activeMaxBudget)
        : 0;

  async function handleSave() {
    if (!user) {
      toast('Inicia sesión o regístrate para guardar tu outfit.');
      return;
    }
    const cleanName = outfit.name.trim();
    if (!cleanName) {
      toast('Ponle un nombre a tu outfit antes de guardar.');
      return;
    }
    if (pieces(outfit).length === 0) {
      toast('Agrega al menos una prenda antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      const saved = await api.saveOutfit({
        name: cleanName,
        pieces: toPiecesPayload(outfit),
      });
      toast(`Outfit “${saved.name}” guardado`);
    } catch (err) {
      handleError(err, 'No pudimos guardar el outfit.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportList() {
    if (pieces(outfit).length === 0) {
      toast('Agrega prendas para exportar la lista.');
      return;
    }
    setList(shoppingList(outfit, outfit.name || 'Mi outfit'));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(list);
      toast('Lista copiada');
    } catch {
      toast('Selecciona el texto y cópialo.');
    }
  }

  return (
    <>
      {SLOT_ORDER.map((slot) => {
        const piece = outfit.items[slot];
        const isLocked = outfit.locked.includes(slot);
        return (
          <div className="slot" key={slot}>
            <span className="ib">{CATEGORIES[slot]}</span>
            {piece ? (
              <span className="thumb">
                <ProductImage
                  src={piece.primaryImageUrl}
                  name={piece.name}
                  category={piece.category}
                  color={piece.color}
                />
              </span>
            ) : (
              <span />
            )}
            <div>
              {piece ? (
                <>
                  <b>{piece.name}</b>
                  <small>
                    {piece.store?.name || 'Tienda'} ·{' '}
                    <Price priceCop={piece.priceCop} />
                  </small>
                </>
              ) : (
                <span className="mut">Vacío</span>
              )}
            </div>
            <div className="row2" style={{ margin: 0 }}>
              {piece ? (
                <>
                  <button
                    type="button"
                    className="mini"
                    aria-pressed={isLocked}
                    onClick={() => lock(slot)}
                  >
                    {isLocked ? '🔒 Bloqueada' : 'Bloquear'}
                  </button>
                  <a
                    className="mini"
                    href={piece.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Comprar
                  </a>
                  <button
                    type="button"
                    className="mini"
                    onClick={() => remove(slot)}
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mini"
                  onClick={() => onSlot(slot)}
                >
                  Elegir
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="total">
        <span>Total</span>
        <span>{formatCOP(tot)}</span>
      </div>

      <label className="row2 mut" style={{ margin: '6px 0' }}>
        <span>Presupuesto máximo</span>
        <input
          type="number"
          min={0}
          step={10000}
          placeholder="Sin límite"
          value={activeMaxBudget ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            setBudget(raw === '' ? null : Math.max(0, Number(raw) || 0));
          }}
          style={{ width: 140 }}
        />
        <span>COP</span>
      </label>

      {activeMaxBudget && activeMaxBudget > 0 ? (
        over ? (
          <div className="warn" role="alert">
            Tu outfit supera el presupuesto por {formatCOP(diffCop)}. Puedes
            seguir editando y guardar igual.
          </div>
        ) : (
          <p className="ok">Dentro del presupuesto.</p>
        )
      ) : (
        <p className="mut small">
          Define un presupuesto arriba o en{' '}
          <Link href="/preferences">Preferencias</Link>.
        </p>
      )}

      <p className="mut small">
        El total suma precios de lista; no incluye envío ni impuestos.
      </p>

      <div className="row2">
        <input
          type="text"
          placeholder="Nombre del outfit"
          aria-label="Nombre del outfit"
          value={outfit.name}
          onChange={(e) => renameDraft(e.target.value)}
          style={{ flex: '1 1 180px' }}
        />
        <button
          type="button"
          className="btn pri"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn" onClick={handleExportList}>
          Exportar lista
        </button>
        {pieces(outfit).length > 0 && (
          <button type="button" className="btn" onClick={clearDraft}>
            Limpiar
          </button>
        )}
      </div>

      {!user && (
        <p className="mut small">
          Para guardar tus outfits en la nube,{' '}
          <Link href="/auth">inicia sesión o regístrate</Link>.
        </p>
      )}

      {list && (
        <>
          <textarea className="ed-textarea" readOnly value={list} />
          <button type="button" className="btn pri" onClick={handleCopy}>
            Copiar
          </button>
        </>
      )}
    </>
  );
}
