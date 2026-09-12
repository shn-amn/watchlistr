import React from 'react';
import {
  Check,
  Copy,
  Download,
  RefreshCw,
  Smartphone,
  Sparkles,
  Upload,
  User,
  X
} from 'lucide-react';
import type { NostrUser } from '../../types';
import { detectDeviceType } from '../../utils';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onboardingStep: number | 'expert';
  setOnboardingStep: React.Dispatch<React.SetStateAction<number | 'expert'>>;
  onboardingDesktopDevice: 'android' | 'ios' | null;
  setOnboardingDesktopDevice: React.Dispatch<React.SetStateAction<'android' | 'ios' | null>>;
  directAuthTab: 'bunker' | 'extension' | 'readonly';
  setDirectAuthTab: React.Dispatch<React.SetStateAction<'bunker' | 'extension' | 'readonly'>>;
  bunkerConnectMode: 'qr' | 'manual';
  setBunkerConnectMode: React.Dispatch<React.SetStateAction<'qr' | 'manual'>>;
  bunkerInputUrl: string;
  setBunkerInputUrl: (v: string) => void;
  bunkerConnecting: boolean;
  bunkerError: string | null;
  setBunkerError: (err: string | null) => void;
  authChallengeUrl: string | null;
  readOnlyInputKey: string;
  setReadOnlyInputKey: (k: string) => void;
  nostrConnectUri: string | null;
  isNostrConnectListening: boolean;
  hasNostrExtension: boolean;
  nostrUser: NostrUser | null;
  handleStartNostrConnect: () => void;
  handleDirectBunkerManualLogin: (uri: string) => void;
  handleDirectExtensionLogin: () => void;
  handleDirectReadOnlyLogin: (key: string) => void;
  profileEditName: string;
  setProfileEditName: (v: string) => void;
  profileEditPicture: string;
  setProfileEditPicture: (v: string) => void;
  selectedImageFile: File | null;
  cropZoom: number;
  setCropZoom: (z: number) => void;
  cropOffset: { x: number; y: number };
  setCropOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isDraggingPhoto: boolean;
  setIsDraggingPhoto: (d: boolean) => void;
  dragStartRef: React.MutableRefObject<{ x: number; y: number }>;
  isDraggingAvatar: boolean;
  setIsDraggingAvatar: (d: boolean) => void;
  handleFileSelection: (f: File) => void;
  handlePublishProfile: (e: React.FormEvent) => Promise<void> | void;
  profileStatus: { type: 'success' | 'error'; message: string } | null;
  isPublishingProfile: boolean;
  publishingStep: 'uploading' | 'publishing' | null;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onboardingStep,
  setOnboardingStep,
  onboardingDesktopDevice,
  setOnboardingDesktopDevice,
  directAuthTab,
  setDirectAuthTab,
  bunkerConnectMode,
  setBunkerConnectMode,
  bunkerInputUrl,
  setBunkerInputUrl,
  bunkerConnecting,
  bunkerError,
  setBunkerError,
  authChallengeUrl,
  readOnlyInputKey,
  setReadOnlyInputKey,
  nostrConnectUri,
  isNostrConnectListening,
  hasNostrExtension,
  nostrUser,
  handleStartNostrConnect,
  handleDirectBunkerManualLogin,
  handleDirectExtensionLogin,
  handleDirectReadOnlyLogin,
  profileEditName,
  setProfileEditName,
  profileEditPicture,
  setProfileEditPicture,
  selectedImageFile,
  cropZoom,
  setCropZoom,
  cropOffset,
  setCropOffset,
  isDraggingPhoto,
  setIsDraggingPhoto,
  dragStartRef,
  isDraggingAvatar,
  setIsDraggingAvatar,
  handleFileSelection,
  handlePublishProfile,
  profileStatus,
  isPublishingProfile,
  publishingStep
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => { if (onboardingStep !== 4) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>

        {/* Modal Header & Progress Indicator */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} />
            <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem' }}>
              {onboardingStep === 0 ? 'Welcome to Watchlistr' : onboardingStep === 'expert' ? 'Sign In to Watchlistr' : 'Nostr Setup Guide'}
            </h3>
            {onboardingStep === 0 ? (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                Sign In
              </span>
            ) : onboardingStep === 'expert' ? (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)', backgroundColor: 'var(--accent-color-light)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                Expert Mode
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)', backgroundColor: 'var(--accent-color-light)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                Step {onboardingStep} of 4
              </span>
            )}
          </div>
          <button
            className="btn btn-action-icon"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>

          {/* STEP 0: WELCOME & INITIAL METHOD SELECTION */}
          {onboardingStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', alignItems: 'center', padding: '1rem 0.5rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-color-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-color)',
                marginBottom: '0.25rem'
              }}>
                <Sparkles size={28} />
              </div>

              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Welcome to Watchlistr! 🍿
              </div>

              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '420px' }}>
                Watchlistr is built on <strong>Nostr</strong> — an open network where you own 100% of your watchlists and profile. We'll guide you step-by-step to set up your mobile key manager.
              </p>

              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '0.8rem 1.25rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  marginTop: '0.5rem'
                }}
                onClick={() => {
                  const dev = detectDeviceType();
                  setOnboardingDesktopDevice(null);
                  if (dev === 'android' || dev === 'ios') {
                    setOnboardingStep(2);
                  } else {
                    setOnboardingStep(1);
                  }
                }}
              >
                <Sparkles size={18} /> Help me set up an account →
              </button>

              {/* De-emphasized option for experienced users */}
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOnboardingStep('expert')}
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'underline',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    padding: '0.4rem 0.8rem'
                  }}
                >
                  I can manage my Nostr connection
                </button>
              </div>
            </div>
          )}

          {/* EXPERT MODE: DIRECT LOGIN TABS ONLY */}
          {onboardingStep === 'expert' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Connect Your Nostr Account</div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Choose your preferred sign-in method below.
                </p>
              </div>

              {/* Direct Login Tabs */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-small ${directAuthTab === 'bunker' ? 'btn-primary' : 'btn-action-icon'}`}
                  onClick={() => { setDirectAuthTab('bunker'); setBunkerError(null); }}
                  style={{ flex: 1, justifyContent: 'center', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <Smartphone size={15} style={{ marginRight: '4px' }} /> Remote Signer
                </button>
                <button
                  type="button"
                  className={`btn btn-small ${directAuthTab === 'extension' ? 'btn-primary' : 'btn-action-icon'}`}
                  onClick={() => { setDirectAuthTab('extension'); setBunkerError(null); }}
                  style={{ flex: 1, justifyContent: 'center', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <Check size={15} style={{ marginRight: '4px' }} /> Extension
                </button>
                <button
                  type="button"
                  className={`btn btn-small ${directAuthTab === 'readonly' ? 'btn-primary' : 'btn-action-icon'}`}
                  onClick={() => { setDirectAuthTab('readonly'); setBunkerError(null); }}
                  style={{ flex: 1, justifyContent: 'center', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <User size={15} style={{ marginRight: '4px' }} /> Read-Only
                </button>
              </div>

              {/* Tab 1: Remote Signer (NIP-46) */}
              {directAuthTab === 'bunker' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Connect securely via Amber, Clave, Nsec.app, or any NIP-46 remote signer app.
                  </p>

                  <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                    <button
                      type="button"
                      className={`btn ${bunkerConnectMode === 'qr' ? 'btn-primary' : 'btn-action-icon'}`}
                      onClick={() => { setBunkerConnectMode('qr'); handleStartNostrConnect(); }}
                      style={{ flex: 1, justifyContent: 'center', padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                    >
                      Pair App / QR
                    </button>
                    <button
                      type="button"
                      className={`btn ${bunkerConnectMode === 'manual' ? 'btn-primary' : 'btn-action-icon'}`}
                      onClick={() => setBunkerConnectMode('manual')}
                      style={{ flex: 1, justifyContent: 'center', padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
                    >
                      Paste Bunker URI
                    </button>
                  </div>

                  {bunkerConnectMode === 'qr' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: '100%', padding: '0.25rem 0' }}>
                      {nostrConnectUri ? (
                        <>
                          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(nostrConnectUri)}`}
                              alt="Nostr Connect QR Code"
                              width={170}
                              height={170}
                              style={{ display: 'block' }}
                            />
                          </div>

                          <a
                            href={nostrConnectUri}
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem', color: '#ffffff', textDecoration: 'none', fontWeight: 700 }}
                          >
                            Open in Remote Signer App
                          </a>

                          {authChallengeUrl && (
                            <a
                              href={authChallengeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary"
                              style={{ width: '100%', justifyContent: 'center', padding: '0.7rem', backgroundColor: '#e11d48' }}
                            >
                              Complete Auth Challenge in Browser
                            </a>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
                            <RefreshCw size={14} className="spin" /> Waiting for remote authorization...
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleStartNostrConnect}
                          disabled={isNostrConnectListening}
                          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700 }}
                        >
                          {isNostrConnectListening ? 'Generating pairing connection...' : 'Start Nostr Connect Pairing'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleDirectBunkerManualLogin(bunkerInputUrl); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="bunker://... or npub1...#bunker=..."
                        value={bunkerInputUrl}
                        onChange={(e) => setBunkerInputUrl(e.target.value)}
                        required
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={bunkerConnecting}
                        style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
                      >
                        {bunkerConnecting ? 'Connecting...' : 'Connect Bunker'}
                      </button>
                    </form>
                  )}

                  {bunkerError && (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                      {bunkerError}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Extension (NIP-07) */}
              {directAuthTab === 'extension' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                  {hasNostrExtension ? (
                    <>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        NIP-07 browser extension detected (Alby, nos2x). Click below to sign in instantly.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleDirectExtensionLogin}
                        style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700 }}
                      >
                        Sign In with Extension (NIP-07)
                      </button>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      No browser extension detected. Install <a href="https://getalby.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>Alby</a> or <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>nos2x</a>, or use the <strong>Remote Signer</strong> option for mobile!
                    </p>
                  )}
                </div>
              )}

              {/* Tab 3: Read-Only Mode */}
              {directAuthTab === 'readonly' && (
                <form onSubmit={(e) => { e.preventDefault(); handleDirectReadOnlyLogin(readOnlyInputKey); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Enter any Nostr public key or npub to view their watchlists in read-only mode:
                  </p>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="npub1... or hex public key"
                    value={readOnlyInputKey}
                    onChange={(e) => setReadOnlyInputKey(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
                  >
                    Connect Read-Only Mode
                  </button>
                </form>
              )}
            </div>
          )}

          {/* STEP 1: DEVICE SELECTION */}
          {onboardingStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {onboardingDesktopDevice === 'ios' || detectDeviceType() === 'ios' ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <Smartphone size={40} style={{ color: 'var(--accent-color)' }} />
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>iPhone & iPad Guidance Coming Soon</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    We currently recommend an <strong>Android device (with Amber)</strong> or a <strong>Desktop Computer</strong> for the easiest onboarding experience.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem' }}
                    onClick={() => {
                      setOnboardingStep(0);
                    }}
                  >
                    Show Direct Login Options
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>What mobile device do you have?</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    We will pair Watchlistr with a secure mobile signer app on your phone.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn"
                      style={{
                        flexDirection: 'column',
                        padding: '1.25rem',
                        gap: '0.5rem',
                        border: '2px solid var(--accent-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        alignItems: 'center'
                      }}
                      onClick={() => {
                        setOnboardingDesktopDevice('android');
                        setOnboardingStep(2);
                      }}
                    >
                      <Smartphone size={28} style={{ color: 'var(--accent-color)' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Android Phone</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Recommended (Amber)</span>
                    </button>

                    <button
                      className="btn"
                      style={{
                        flexDirection: 'column',
                        padding: '1.25rem',
                        gap: '0.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        alignItems: 'center'
                      }}
                      onClick={() => {
                        setOnboardingDesktopDevice('ios');
                        setOnboardingStep(2);
                      }}
                    >
                      <Smartphone size={28} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>iPhone / iPad</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Clave Signer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DOWNLOAD SIGNER APP INSTRUCTIONS */}
          {onboardingStep === 2 && (() => {
            const isIOS = detectDeviceType() === 'ios' || onboardingDesktopDevice === 'ios';
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                    {isIOS ? 'Step 1: Install Clave Signer' : 'Step 1: Install Amber Signer'}
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {isIOS ? 'Install Clave from the App Store to manage your Nostr keys on iOS.' : 'Install Amber from GitHub Releases to manage your Nostr keys on Android.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                  <Smartphone size={32} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{isIOS ? 'Clave Signer for iOS' : 'Amber Signer for Android'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {isIOS ? 'Remote Signer for iPhone & iPad' : 'v2.1.2 • Open Source Nostr Signer'}
                    </div>
                  </div>
                  <a
                    href={isIOS ? 'itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?term=clave+nostr+signer' : 'https://github.com/greenart7c3/Amber/releases/latest'}
                    onClick={(e) => {
                      if (isIOS) {
                        e.preventDefault();
                        window.location.href = 'itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?term=clave+nostr+signer';
                      }
                    }}
                    target={isIOS ? '_self' : '_blank'}
                    rel="noreferrer"
                    className="btn btn-primary btn-small"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: '#ffffff' }}
                  >
                    <Download size={14} /> {isIOS ? 'App Store' : 'Download APK'}
                  </a>
                </div>

                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Quick Steps:</strong>
                  {isIOS ? (
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <li>Install <strong>Clave – Nostr Signer</strong> from the Apple App Store.</li>
                      <li>Open Clave and follow its quick setup steps to create your new Nostr identity (key pair).</li>
                      <li>Once your identity is created in Clave, return here and click the button below.</li>
                    </ol>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <li>Look under <strong>Assets</strong> at the bottom of the latest Amber release.</li>
                      <li>
                        Choose which <code>.apk</code> to download:
                        <ul style={{ margin: '0.2rem 0', paddingLeft: '1rem', listStyleType: 'disc' }}>
                          <li>Download <code>amber-arm64-v...apk</code> for modern Android phones.</li>
                          <li>Or download <code>amber-fdroid-universal-v...apk</code> if you're not sure!</li>
                        </ul>
                      </li>
                      <li>Install the APK and open Amber to create your new Nostr identity (key pair).</li>
                      <li>Once your identity is created in Amber, return here and click the button below.</li>
                    </ol>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.25rem', fontWeight: 700 }}
                  onClick={() => {
                    handleStartNostrConnect();
                    setOnboardingStep(3);
                  }}
                >
                  I have my signer ready →
                </button>
              </div>
            );
          })()}

          {/* STEP 3: NOSTR CONNECT PAIRING */}
          {onboardingStep === 3 && (() => {
            const isIOS = detectDeviceType() === 'ios' || onboardingDesktopDevice === 'ios';
            const signerName = isIOS ? 'Clave' : 'Amber';
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', alignItems: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Connect Watchlistr to {signerName}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Authorize Watchlistr to communicate with {signerName} via Nostr Connect (NIP-46).
                </p>

                {nostrConnectUri ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%' }}>
                    {detectDeviceType() === 'android' || detectDeviceType() === 'ios' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <a
                          href={nostrConnectUri}
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '0.85rem', justifyContent: 'center', textDecoration: 'none', color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}
                        >
                          <Smartphone size={18} /> Open in {signerName} App
                        </a>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            navigator.clipboard.writeText(nostrConnectUri);
                            alert("Connection URI copied to clipboard!");
                          }}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <Copy size={14} /> Copy Connection URI
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(nostrConnectUri)}`}
                            alt="Nostr Connect QR Code"
                            width={180}
                            height={180}
                            style={{ display: 'block' }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Scan with {signerName} app to approve pairing
                        </span>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => {
                            navigator.clipboard.writeText(nostrConnectUri);
                            alert("Connection URI copied to clipboard!");
                          }}
                          style={{ marginTop: '0.25rem' }}
                        >
                          <Copy size={12} /> Copy Connection URI
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <RefreshCw size={16} className="spin" /> Waiting for connection authorization...
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleStartNostrConnect}
                    style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                  >
                    Generate Connection URI
                  </button>
                )}
              </div>
            );
          })()}

          {/* STEP 4: BUILT-IN PROFILE SETUP */}
          {onboardingStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Connected! Set Up Your Profile 🎨</div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Give yourself a display name and profile picture so your friends can discover your watchlists.
                </p>
              </div>

              <form onSubmit={async (e) => {
                await handlePublishProfile(e);
                onClose();
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Crop & Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
                  onDragLeave={() => setIsDraggingAvatar(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingAvatar(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelection(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    border: isDraggingAvatar ? '2px dashed var(--accent-color)' : '1px dashed var(--border-color)',
                    backgroundColor: isDraggingAvatar ? 'var(--accent-color-light)' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    gap: '0.75rem',
                    textAlign: 'center'
                  }}
                >
                  {selectedImageFile ? (
                    <div
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        position: 'relative',
                        border: '3px solid var(--accent-color)',
                        cursor: isDraggingPhoto ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        touchAction: 'none'
                      }}
                      onMouseDown={(e) => {
                        setIsDraggingPhoto(true);
                        dragStartRef.current = { x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y };
                      }}
                      onMouseMove={(e) => {
                        if (!isDraggingPhoto) return;
                        setCropOffset({
                          x: e.clientX - dragStartRef.current.x,
                          y: e.clientY - dragStartRef.current.y
                        });
                      }}
                      onMouseUp={() => setIsDraggingPhoto(false)}
                      onMouseLeave={() => setIsDraggingPhoto(false)}
                      onTouchStart={(e) => {
                        if (e.touches[0]) {
                          setIsDraggingPhoto(true);
                          dragStartRef.current = { x: e.touches[0].clientX - cropOffset.x, y: e.touches[0].clientY - cropOffset.y };
                        }
                      }}
                      onTouchMove={(e) => {
                        if (isDraggingPhoto && e.touches[0]) {
                          setCropOffset({
                            x: e.touches[0].clientX - dragStartRef.current.x,
                            y: e.touches[0].clientY - dragStartRef.current.y
                          });
                        }
                      }}
                      onTouchEnd={() => setIsDraggingPhoto(false)}
                    >
                      <img
                        src={profileEditPicture}
                        alt="Crop Preview"
                        draggable={false}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                          transformOrigin: 'center center',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  ) : (profileEditPicture || nostrUser?.picture) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <img
                        src={profileEditPicture || nostrUser?.picture}
                        alt="Profile Avatar"
                        style={{
                          width: '90px',
                          height: '90px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '3px solid var(--accent-color)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <Upload size={24} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Drag & drop avatar photo here</span>
                    </div>
                  )}

                  <label className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                    Browse Computer
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelection(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  {selectedImageFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '240px', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Zoom:</span>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                    </div>
                  )}
                </div>

                {/* Name Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Display Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. MovieBuff99"
                    value={profileEditName}
                    onChange={(e) => setProfileEditName(e.target.value)}
                    required
                  />
                </div>

                {/* Avatar URL Fallback Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Avatar Image URL (Optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://example.com/avatar.jpg"
                    value={selectedImageFile ? 'Local image selected above (Will auto-host on nostr.build)' : profileEditPicture}
                    disabled={!!selectedImageFile}
                    onChange={(e) => setProfileEditPicture(e.target.value)}
                  />
                </div>

                {profileStatus && (
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    backgroundColor: profileStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: profileStatus.type === 'success' ? '#22c55e' : '#ef4444',
                    border: profileStatus.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    {profileStatus.message}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={onClose}
                  >
                    Skip for Now
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isPublishingProfile}
                    style={{ flex: 1, justifyContent: 'center', fontWeight: 700 }}
                  >
                    {isPublishingProfile ? (
                      <>
                        <RefreshCw size={16} className="spin" style={{ marginRight: '6px' }} />
                        {publishingStep === 'uploading' ? 'Uploading Image...' : 'Publishing Profile...'}
                      </>
                    ) : (
                      'Save Profile →'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Wizard Navigation Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
          {onboardingStep === 'expert' ? (
            <button
              className="btn btn-small"
              onClick={() => setOnboardingStep(0)}
            >
              ← Back to Setup Guide
            </button>
          ) : typeof onboardingStep === 'number' && onboardingStep > 0 ? (
            <button
              className="btn btn-small"
              onClick={() => setOnboardingStep(prev => (typeof prev === 'number' && prev === 1 ? 0 : (prev as number) - 1))}
            >
              ← Back
            </button>
          ) : (
            <div></div>
          )}

          <button
            className="btn btn-small"
            onClick={onClose}
            style={{ color: 'var(--text-tertiary)' }}
          >
            {onboardingStep === 0 ? 'Close' : 'Cancel'}
          </button>
        </div>

      </div>
    </div>
  );
};
