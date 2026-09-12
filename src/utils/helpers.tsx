import React from 'react';
import type { Media, DeviceType } from '../types';
import { RATING_EMOJIS } from '../constants';

export const getRatingEmoji = (rating: number | undefined): string => {
  if (rating === undefined || isNaN(rating)) return '⭐';
  const rounded = Math.min(Math.max(Math.round(rating), 1), 10);
  return RATING_EMOJIS[rounded]?.emoji || '⭐';
};

// Render director or creator info cleanly below title, with production year
export const renderDirectorCreator = (item: Media): React.ReactNode => {
  const creatorOrDirector = item.type === 'movie' ? item.director : item.creator;
  const year = item.year ? String(item.year).trim() : null;

  if (creatorOrDirector && year) {
    return <div className="media-creator-director">{creatorOrDirector}, {year}</div>;
  }
  if (creatorOrDirector) {
    return <div className="media-creator-director">{creatorOrDirector}</div>;
  }
  if (year) {
    return <div className="media-creator-director">{year}</div>;
  }
  return null;
};

export const cleanListTitle = (title: string): string => {
  return title ? title.replace(/\s*\(Default\)$/i, '').trim() : '';
};

export const detectDeviceType = (): DeviceType => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  return 'desktop';
};

export const renderListTitle = (list: { id: string; title: string }): string => {
  return cleanListTitle(list.title);
};
