import React from 'react';
import { X } from 'lucide-react';
import type { LogModalState } from '../../types';
import { RATING_EMOJIS } from '../../constants';
import { getDayOptions, getRatingEmoji, getYearOptions } from '../../utils';

interface LogWatchedModalProps {
  modal: LogModalState;
  setModal: React.Dispatch<React.SetStateAction<LogModalState>>;
  onClose: () => void;
  onSave: () => void;
  onSetToday: () => void;
}

export const LogWatchedModal: React.FC<LogWatchedModalProps> = ({
  modal,
  setModal,
  onClose,
  onSave,
  onSetToday
}) => {
  if (!modal.isOpen || !modal.item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>
            {modal.sourceList === 'edit' ? 'Edit Watched Details' : 'Log as Watched'}
          </h3>
          <button
            className="btn btn-action-icon"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
          {modal.item.poster && (
            <img src={modal.item.poster} alt={modal.item.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
          )}
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{modal.item.title}</h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{modal.item.year}</div>
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Date Watched</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="input-field select-field"
              value={modal.year}
              onChange={(e) => setModal(prev => ({ ...prev, year: e.target.value, month: '', day: '' }))}
              style={{ flex: '1.2 1 0px', minWidth: '90px' }}
            >
              <option value="">Year...</option>
              {getYearOptions(modal.year).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              className="input-field select-field"
              value={modal.month}
              disabled={!modal.year}
              onChange={(e) => setModal(prev => ({ ...prev, month: e.target.value, day: '' }))}
              style={{ flex: '1.5 1 0px', minWidth: '100px' }}
            >
              <option value="">Month...</option>
              <option value="01">Jan (01)</option>
              <option value="02">Feb (02)</option>
              <option value="03">Mar (03)</option>
              <option value="04">Apr (04)</option>
              <option value="05">May (05)</option>
              <option value="06">Jun (06)</option>
              <option value="07">Jul (07)</option>
              <option value="08">Aug (08)</option>
              <option value="09">Sep (09)</option>
              <option value="10">Oct (10)</option>
              <option value="11">Nov (11)</option>
              <option value="12">Dec (12)</option>
            </select>

            <select
              className="input-field select-field"
              value={modal.day}
              disabled={!modal.year || !modal.month}
              onChange={(e) => setModal(prev => ({ ...prev, day: e.target.value }))}
              style={{ flex: '0.8 1 0px', minWidth: '80px' }}
            >
              <option value="">Day...</option>
              {getDayOptions(modal.year, modal.month).map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <button
              type="button"
              className="btn"
              style={{ whiteSpace: 'nowrap' }}
              onClick={onSetToday}
            >
              Today
            </button>
          </div>
        </div>

        <div className="modal-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="modal-label">Your Rating</label>
            {modal.rating !== '' && (
              <span className="desktop-rating-score" style={{ fontSize: '0.82rem', fontWeight: 650, color: 'var(--accent-color)' }}>
                {modal.rating}/10 {RATING_EMOJIS[parseFloat(modal.rating)]?.label ? `- ${RATING_EMOJIS[parseFloat(modal.rating)]?.label}` : ''}
              </span>
            )}
          </div>

          {/* Desktop Rating View: 1-10 Emoji Buttons */}
          <div className="rating-picker-desktop">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
              const value = val.toString();
              const isActive = modal.rating === value;
              const emojiObj = RATING_EMOJIS[val] || { emoji: '⭐', label: '' };
              return (
                <button
                  key={value}
                  type="button"
                  className={`emoji-picker-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setModal(prev => ({ ...prev, rating: prev.rating === value ? '' : value }))}
                  title={`${val}/10 - ${emojiObj.label}`}
                >
                  {emojiObj.emoji}
                </button>
              );
            })}
          </div>

          {/* Mobile Rating View: Gradient Gauge with Dynamic Smiley Only */}
          <div className="rating-picker-mobile rating-gauge-card">
            <div className="rating-gauge-display">
              {modal.rating !== '' ? (
                <div key={modal.rating} className="rating-gauge-emoji">
                  {getRatingEmoji(parseFloat(modal.rating))}
                </div>
              ) : (
                <div className="rating-gauge-emoji" style={{ opacity: 0.35 }}>
                  ⚪
                </div>
              )}
            </div>

            <div className="rating-gauge-slider-container">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={modal.rating || '8'}
                onChange={(e) => setModal(prev => ({ ...prev, rating: e.target.value }))}
                className="rating-gauge-slider gradient-slider"
              />
              <div className="rating-gauge-ticks">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                  const valStr = val.toString();
                  const isActive = modal.rating === valStr;
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`rating-gauge-tick ${isActive ? 'active' : ''}`}
                      onClick={() => setModal(prev => ({ ...prev, rating: valStr }))}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions-bar">
          <button
            className="btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
