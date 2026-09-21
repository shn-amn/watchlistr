import { useState, useEffect, useRef, useCallback } from 'react';
import {
  NostrService,
  Nip07Signer,
  ReadOnlySigner,
  BunkerNip46Signer,
  createBunkerSigner,
  startNostrConnectSession,
  uploadNostrImage
} from '../nostr';
import type { NostrSigner } from '../nostr';
import { DEFAULT_RELAYS } from '../constants';
import type { NostrUser, ConnectionStatus } from '../types';
import { decodeNpubToHex } from '../utils';

// Progressive backoff retry intervals: 1m, 2m, 5m, 15m, 1h, 4h, 12h, 24h
const RETRY_INTERVALS = [60, 120, 300, 900, 3600, 14400, 43200, 86400];

export interface UseNostrAuthProps {
  onLoginSuccess?: (pubkey: string) => void;
  onLogout?: () => void;
}


export function useNostrAuth({ onLoginSuccess, onLogout }: UseNostrAuthProps = {}) {
  // Nostr User & Signer states
  const [nostrUser, setNostrUser] = useState<NostrUser | null>(() => {
    const savedUser = localStorage.getItem('watchlistr_nostr_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const activeSignerRef = useRef<NostrSigner | null>(null);
  const nostrServiceRef = useRef<NostrService | null>(null);
  const [hasNostrExtension, setHasNostrExtension] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [relayStatuses, setRelayStatuses] = useState<Record<string, boolean>>({});

  // Connection status & auto-reconnect backoff
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    const savedUser = localStorage.getItem('watchlistr_nostr_user');
    if (!savedUser) return 'disconnected';
    try {
      const u = JSON.parse(savedUser);
      return u.signerType === 'bunker' ? 'connecting' : 'connected';
    } catch {
      return 'disconnected';
    }
  });
  const retryIndexRef = useRef<number>(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals visibility
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Guided Onboarding & Direct Login Wizard state
  const [onboardingStep, setOnboardingStep] = useState<number | 'expert'>(0);
  const onboardingStepRef = useRef(onboardingStep);
  useEffect(() => {
    onboardingStepRef.current = onboardingStep;
  }, [onboardingStep]);

  const [onboardingDesktopDevice, setOnboardingDesktopDevice] = useState<'android' | 'ios' | null>(null);
  const [directAuthTab, setDirectAuthTab] = useState<'bunker' | 'extension' | 'readonly'>('bunker');
  const [bunkerConnectMode, setBunkerConnectMode] = useState<'qr' | 'manual'>('qr');
  const [bunkerInputUrl, setBunkerInputUrl] = useState('');
  const [bunkerConnecting, setBunkerConnecting] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [authChallengeUrl, setAuthChallengeUrl] = useState<string | null>(null);
  const [readOnlyInputKey, setReadOnlyInputKey] = useState('');
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [isNostrConnectListening, setIsNostrConnectListening] = useState<boolean>(false);

  // Re-pair from scratch state for broken bunker connections
  const [repairConnectUri, setRepairConnectUri] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const repairSessionRef = useRef<any>(null);

  // Profile Edit state & Deferred Upload with Interactive Crop & Zoom
  const [profileEditName, setProfileEditName] = useState('');
  const [profileEditPicture, setProfileEditPicture] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isPublishingProfile, setIsPublishingProfile] = useState(false);
  const [publishingStep, setPublishingStep] = useState<'uploading' | 'publishing' | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  // Initialize Nostr Extension check and WebSocket Service
  useEffect(() => {
    const service = new NostrService(DEFAULT_RELAYS);
    nostrServiceRef.current = service;

    service.connectRelays((statuses) => {
      setRelayStatuses({ ...statuses });
    });

    const checkExtension = () => {
      if (window.nostr) {
        setHasNostrExtension(true);
      }
    };
    checkExtension();
    const timer = setTimeout(checkExtension, 1000);

    return () => {
      clearTimeout(timer);
      service.close();
    };
  }, []);

  // Initialize activeSigner on load & handle auto-reconnect for NIP-46 Bunker
  useEffect(() => {
    if (!nostrUser) {
      activeSignerRef.current = null;
      setConnectionStatus('disconnected');
      return;
    }

    if (nostrUser.signerType === 'extension') {
      activeSignerRef.current = new Nip07Signer();
      setConnectionStatus('connected');
    } else if (nostrUser.signerType === 'readonly') {
      activeSignerRef.current = new ReadOnlySigner(nostrUser.pubkey);
      setConnectionStatus('connected');
    } else if (nostrUser.signerType === 'bunker' && nostrUser.bunkerUrl) {
      if (!activeSignerRef.current || (activeSignerRef.current as any).bunkerUrl !== nostrUser.bunkerUrl) {
        setConnectionStatus('connecting');
        createBunkerSigner(nostrUser.bunkerUrl, nostrUser.bunkerClientSk)
          .then(signer => {
            activeSignerRef.current = signer;
            setConnectionStatus('connected');
            retryIndexRef.current = 0;
          })
          .catch(err => {
            console.error("Auto-reconnect NIP-46 Bunker failed:", err);
            setConnectionStatus('broken');
          });
      }
    }

    if (nostrUser.pubkey && onLoginSuccess) {
      onLoginSuccess(nostrUser.pubkey);
    }
  }, [nostrUser?.pubkey, nostrUser?.signerType]);

  const reconnectBunker = useCallback(async (): Promise<boolean> => {
    if (!nostrUser || nostrUser.signerType !== 'bunker' || !nostrUser.bunkerUrl) {
      return false;
    }
    setConnectionStatus('connecting');
    try {
      if (activeSignerRef.current && 'close' in activeSignerRef.current) {
        try {
          await (activeSignerRef.current as BunkerNip46Signer).close();
        } catch (e) {}
      }
      const signer = await createBunkerSigner(nostrUser.bunkerUrl, nostrUser.bunkerClientSk);
      const pk = await signer.getPublicKey();
      if (pk) {
        activeSignerRef.current = signer;
        setConnectionStatus('connected');
        retryIndexRef.current = 0;
        return true;
      }
      setConnectionStatus('broken');
      return false;
    } catch (err) {
      console.error("Manual reconnect Bunker failed:", err);
      setConnectionStatus('broken');
      return false;
    }
  }, [nostrUser]);

  // Periodic auto-retry with progressive backoff when connection is broken
  useEffect(() => {
    if (connectionStatus !== 'broken' || !nostrUser || nostrUser.signerType !== 'bunker') {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    const intervalSeconds = RETRY_INTERVALS[Math.min(retryIndexRef.current, RETRY_INTERVALS.length - 1)];

    retryTimeoutRef.current = setTimeout(async () => {
      console.log(`Auto-retry bunker reconnect firing (attempt ${retryIndexRef.current + 1}, interval ${intervalSeconds}s)...`);
      const success = await reconnectBunker();
      if (!success) {
        retryIndexRef.current += 1;
      }
    }, intervalSeconds * 1000);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [connectionStatus, nostrUser, reconnectBunker]);

  // Trigger immediate reconnect when device comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (connectionStatus === 'broken' && nostrUser?.signerType === 'bunker') {
        console.log("Network online event detected, attempting immediate bunker reconnect...");
        reconnectBunker();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connectionStatus, nostrUser, reconnectBunker]);


  const startRepairSession = useCallback(async (onSuccess?: () => void): Promise<boolean> => {
    setIsRepairing(true);
    setRepairConnectUri(null);

    const session = startNostrConnectSession(DEFAULT_RELAYS);
    repairSessionRef.current = session;
    setRepairConnectUri(session.uri);

    try {
      const signer = await session.listen();
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();

      setNostrUser(prev => {
        const updated: NostrUser = {
          pubkey: pubkey || prev?.pubkey || '',
          name: prev?.name,
          picture: prev?.picture,
          readOnly: false,
          signerType: 'bunker',
          bunkerUrl: signer.bunkerUrl,
          bunkerClientSk: signer.clientSecretKeyHex
        };
        localStorage.setItem('watchlistr_nostr_user', JSON.stringify(updated));
        return updated;
      });

      setConnectionStatus('connected');
      retryIndexRef.current = 0;
      setRepairConnectUri(null);
      setIsRepairing(false);
      repairSessionRef.current = null;

      if (onSuccess) {
        onSuccess();
      }
      return true;
    } catch (err) {
      console.error("Re-pairing session failed:", err);
      setIsRepairing(false);
      setRepairConnectUri(null);
      repairSessionRef.current = null;
      return false;
    }
  }, []);

  const cancelRepairSession = useCallback(() => {
    setIsRepairing(false);
    setRepairConnectUri(null);
    repairSessionRef.current = null;
  }, []);

  // Sync fetched profile metadata into profile edit state when modal is open
  useEffect(() => {
    const isEditingProfile = isConnectionModalOpen || (isOnboardingOpen && onboardingStep === 4);
    if (isEditingProfile && nostrUser) {
      if (nostrUser.name) {
        setProfileEditName(prev => prev || nostrUser.name || '');
      }
      if (nostrUser.picture && !selectedImageFile) {
        setProfileEditPicture(prev => prev || nostrUser.picture || '');
      }
    }
  }, [isConnectionModalOpen, isOnboardingOpen, onboardingStep, nostrUser, nostrUser?.name, nostrUser?.picture, selectedImageFile]);

  // Auto-advance onboarding to Step 4 (Profile Setup) ONLY for brand-new users without profile
  useEffect(() => {
    if (isOnboardingOpen && onboardingStep === 3 && nostrUser) {
      if (!nostrUser.name && !nostrUser.picture) {
        setOnboardingStep(4);
      } else {
        setIsOnboardingOpen(false);
      }
    }
  }, [isOnboardingOpen, onboardingStep, nostrUser]);

  const handleDirectExtensionLogin = async () => {
    if (!window.nostr) {
      alert("No NIP-07 extension detected. Please install Alby or nos2x, or use Remote Signer.");
      return;
    }

    try {
      const signer = new Nip07Signer();
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();
      if (pubkey) {
        const user: NostrUser = { pubkey, readOnly: false, signerType: 'extension' };
        setNostrUser(user);
        setConnectionStatus('connected');
        localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
        setIsOnboardingOpen(false);
      }
    } catch (err) {
      console.error("Failed to connect Nostr extension:", err);
      alert("Failed to get public key from extension.");
    }
  };

  const handleDirectBunkerManualLogin = async (url: string) => {
    if (!url.trim()) return;
    setBunkerConnecting(true);
    setBunkerError(null);
    setAuthChallengeUrl(null);

    try {
      const signer = await createBunkerSigner(url, undefined, (authUrl) => {
        setAuthChallengeUrl(authUrl);
      });
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();

      const user: NostrUser = {
        pubkey,
        readOnly: false,
        signerType: 'bunker',
        bunkerUrl: url.trim(),
        bunkerClientSk: signer.clientSecretKeyHex
      };

      setNostrUser(user);
      setConnectionStatus('connected');
      retryIndexRef.current = 0;
      localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
      setBunkerInputUrl('');
      setIsOnboardingOpen(false);
    } catch (err: any) {
      console.error("Failed to connect NIP-46 Bunker:", err);
      setBunkerError(err.message || String(err));
    } finally {
      setBunkerConnecting(false);
    }
  };

  const handleDirectReadOnlyLogin = (rawKey: string) => {
    const hex = decodeNpubToHex(rawKey);
    if (!hex || hex.length !== 64) {
      alert("Invalid Nostr public key or npub format.");
      return;
    }
    const signer = new ReadOnlySigner(hex);
    activeSignerRef.current = signer;
    const user: NostrUser = { pubkey: hex, readOnly: true, signerType: 'readonly' };
    setNostrUser(user);
    setConnectionStatus('connected');
    localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
    setReadOnlyInputKey('');
    setIsOnboardingOpen(false);
  };

  const handleStartNostrConnect = async () => {
    setIsNostrConnectListening(true);
    setBunkerError(null);
    setAuthChallengeUrl(null);

    const session = startNostrConnectSession(DEFAULT_RELAYS, (authUrl) => {
      setAuthChallengeUrl(authUrl);
    });

    setNostrConnectUri(session.uri);

    try {
      const signer = await session.listen();
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();

      setNostrUser(prev => {
        const updated: NostrUser = {
          pubkey,
          name: prev?.name,
          picture: prev?.picture,
          readOnly: false,
          signerType: 'bunker',
          bunkerUrl: signer.bunkerUrl,
          bunkerClientSk: signer.clientSecretKeyHex
        };
        localStorage.setItem('watchlistr_nostr_user', JSON.stringify(updated));
        return updated;
      });

      setConnectionStatus('connected');
      retryIndexRef.current = 0;
      setNostrConnectUri(null);
      if (onboardingStepRef.current === 0 || onboardingStepRef.current === 'expert' || (nostrUser && (nostrUser.name || nostrUser.picture))) {
        setIsOnboardingOpen(false);
      } else {
        setOnboardingStep(4);
      }
    } catch (err: any) {
      console.error("Nostr Connect session failed:", err);
      setBunkerError(err.message || String(err));
    } finally {
      setIsNostrConnectListening(false);
    }
  };

  const logoutNostr = () => {
    cancelRepairSession();
    if (activeSignerRef.current && 'close' in activeSignerRef.current) {
      try {
        (activeSignerRef.current as BunkerNip46Signer).close();
      } catch (e) { }
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryIndexRef.current = 0;
    setConnectionStatus('disconnected');
    activeSignerRef.current = null;
    setNostrUser(null);
    localStorage.removeItem('watchlistr_nostr_user');

    if (onLogout) {
      onLogout();
    }
  };

  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setProfileStatus({ type: 'error', message: 'Please select a valid image file.' });
      return;
    }
    setSelectedImageFile(file);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    const localPreview = URL.createObjectURL(file);
    setProfileEditPicture(localPreview);
    setProfileStatus(null);
  };

  const generateCroppedAvatarFile = (
    file: File,
    zoom: number,
    offset: { x: number; y: number }
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to initialize canvas context."));
          return;
        }

        const viewportSize = 120;
        const targetSize = 600;

        const baseScale = Math.max(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight);
        const effectiveScale = baseScale * zoom;

        const cropWidth = viewportSize / effectiveScale;
        const cropHeight = viewportSize / effectiveScale;

        const centerX = (img.naturalWidth / 2) - (offset.x / effectiveScale);
        const centerY = (img.naturalHeight / 2) - (offset.y / effectiveScale);

        const srcX = centerX - (cropWidth / 2);
        const srcY = centerY - (cropHeight / 2);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, srcX, srcY, cropWidth, cropHeight, 0, 0, targetSize, targetSize);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas blob export failed."));
            return;
          }
          const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          resolve(croppedFile);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  };

  const handlePublishProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    if (!profileEditName.trim()) {
      setProfileStatus({ type: 'error', message: 'Display name cannot be empty.' });
      return;
    }

    setIsPublishingProfile(true);
    setProfileStatus(null);

    try {
      let finalPictureUrl = profileEditPicture.trim();

      if (selectedImageFile) {
        setPublishingStep('uploading');
        const croppedFile = await generateCroppedAvatarFile(selectedImageFile, cropZoom, cropOffset);
        finalPictureUrl = await uploadNostrImage(croppedFile, activeSignerRef.current);
        setProfileEditPicture(finalPictureUrl);
        setSelectedImageFile(null);
      }

      setPublishingStep('publishing');
      let existingMeta: Record<string, any> = {};
      const existingProfileEvent = await nostrServiceRef.current.fetchUserProfile(nostrUser.pubkey);
      if (existingProfileEvent?.content) {
        try {
          existingMeta = JSON.parse(existingProfileEvent.content);
        } catch (err) { }
      }

      const updatedMeta = {
        ...existingMeta,
        name: profileEditName.trim(),
        display_name: profileEditName.trim(),
        picture: finalPictureUrl
      };

      const unsignedEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: JSON.stringify(updatedMeta)
      };

      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);

      setNostrUser(prev => prev ? {
        ...prev,
        name: profileEditName.trim(),
        picture: finalPictureUrl
      } : null);

      setProfileStatus({ type: 'success', message: 'Profile updated & published to Nostr relays!' });
    } catch (err: any) {
      console.error("Failed to publish profile:", err);
      setProfileStatus({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setIsPublishingProfile(false);
      setPublishingStep(null);
    }
  };

  return {
    nostrUser,
    setNostrUser,
    activeSignerRef,
    nostrServiceRef,
    hasNostrExtension,
    isSyncing,
    setIsSyncing,
    relayStatuses,
    isConnectionModalOpen,
    setIsConnectionModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
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
    profileEditName,
    setProfileEditName,
    profileEditPicture,
    setProfileEditPicture,
    selectedImageFile,
    setSelectedImageFile,
    cropZoom,
    setCropZoom,
    cropOffset,
    setCropOffset,
    isDraggingPhoto,
    setIsDraggingPhoto,
    dragStartRef,
    isPublishingProfile,
    publishingStep,
    profileStatus,
    setProfileStatus,
    isDraggingAvatar,
    setIsDraggingAvatar,
    handleDirectExtensionLogin,
    handleDirectBunkerManualLogin,
    handleDirectReadOnlyLogin,
    handleStartNostrConnect,
    logoutNostr,
    handleFileSelection,
    handlePublishProfile,
    connectionStatus,
    setConnectionStatus,
    reconnectBunker,
    repairConnectUri,
    isRepairing,
    startRepairSession,
    cancelRepairSession
  };
}

